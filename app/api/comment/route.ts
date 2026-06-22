import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/origin-check";
import { isRetryableError } from "@/lib/anthropic-retry";
import { generateComment } from "@/lib/generate-comment";
import { logError } from "@/lib/log";

export async function POST(request: NextRequest) {
  try {
    // ── Origin検証（CSRF対策） ──
    const originError = validateOrigin(request);
    if (originError) return originError;

    // ── 認証チェック ──
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = claimsData.claims.sub;

    // ── レート制限（1ユーザー 20回/時間） ──
    const { success, remaining, resetAt } = await rateLimit(
      `comment:${userId}`,
      20,
      60 * 60 * 1000
    );

    if (!success) {
      return NextResponse.json(
        { error: "リクエスト回数の上限に達しました。しばらく経ってからお試しください" },
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

    // 入力文字数制限（過大なリクエスト防止）
    if (content.length > 5000) {
      return NextResponse.json({ error: "入力が長すぎます（5000文字以内）" }, { status: 400 });
    }

    // ── AI コメント生成（共通ロジック・一時エラーはリトライ） ──
    const { comment, emotions, dominant, energy, insightLevel } =
      await generateComment(content);

    return NextResponse.json(
      { comment, emotions, dominant, energy, insightLevel },
      {
        headers: {
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  } catch (error) {
    // 詳細はクライアントに返さず、本番では Sentry にのみ送る
    logError(error, { scope: "api/comment" });
    // Anthropic の一時的な過負荷（529 等）はリトライ後も失敗しうるため、
    // 恒久的な失敗(500)と区別して 503 + 再試行を促すメッセージを返す
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
