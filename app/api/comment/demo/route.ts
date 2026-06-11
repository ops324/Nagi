import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/origin-check";
import { isRetryableError } from "@/lib/anthropic-retry";
import { generateComment } from "@/lib/generate-comment";

// 登録前のお試し体験（/try）用のコメント生成API。
// 本番（/api/comment）との違い:
//   - 認証なし（未ログインでも呼べる）
//   - レート制限は user_id ではなく IP 単位（乱用・コストのバックストップ）
//   - 入力上限を本番より短く設定（コスト抑制）
// ※ 体験を「1回だけ」に絞るのは UI（DemoClient）側の責務。ここは乱用防止が目的。

// IPあたりの上限（共有IP=社内NAT・モバイルキャリアの正当な利用者を巻き込まない緩めの値）
const DEMO_RATE_LIMIT = 5;
const DEMO_RATE_WINDOW_MS = 60 * 60 * 1000; // 1時間
const DEMO_MAX_CHARS = 2000;

export async function POST(request: NextRequest) {
  try {
    // ── Origin検証（CSRF対策） ──
    const originError = validateOrigin(request);
    if (originError) return originError;

    // ── IP レート制限（乱用バックストップ） ──
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

    const { success, resetAt } = await rateLimit(
      `demo:${ip}`,
      DEMO_RATE_LIMIT,
      DEMO_RATE_WINDOW_MS
    );

    if (!success) {
      return NextResponse.json(
        { error: "お試しの上限に達しました。登録すると、続けてご利用いただけます" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // ── 入力バリデーション ──
    const { content } = await request.json();

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "内容が空です" }, { status: 400 });
    }

    if (content.length > DEMO_MAX_CHARS) {
      return NextResponse.json(
        { error: `入力が長すぎます（${DEMO_MAX_CHARS}文字以内）` },
        { status: 400 }
      );
    }

    // ── AI コメント生成（共通ロジック・一時エラーはリトライ） ──
    const { comment, emotions, dominant, energy, insightLevel } =
      await generateComment(content);

    return NextResponse.json({ comment, emotions, dominant, energy, insightLevel });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Demo API error:", error);
    } else {
      console.error("Demo API error: comment generation failed");
    }
    if (isRetryableError(error)) {
      return NextResponse.json(
        { error: "ただいま混み合っています。少し時間をおいてもう一度お試しください" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "コメントの生成に失敗しました" },
      { status: 500 }
    );
  }
}
