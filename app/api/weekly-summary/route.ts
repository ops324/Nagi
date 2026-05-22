import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateOrigin } from "@/lib/origin-check";
import { WEEKLY_SUMMARY_PROMPT } from "@/prompts/weekly-summary-prompt";
import { createMessageWithRetry, isRetryableError } from "@/lib/anthropic-retry";
import { Entry } from "@/app/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: 0, // リトライは createMessageWithRetry で制御する
});

export async function POST(request: NextRequest) {
  try {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const userId = claimsData.claims.sub;

    // レート制限（1ユーザー 10回/時間 — AI生成のコスト保護）
    const { success, resetAt } = await rateLimit(`weekly:${userId}`, 10, 60 * 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { error: "リクエスト回数の上限に達しました。しばらく経ってからお試しください" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    const { entries } = await request.json() as { entries: Entry[] };
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "記録がありません" }, { status: 400 });
    }

    const entrySummary = entries
      .slice(0, 10)
      .map((e, i) => {
        const d = new Date(e.createdAt);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        const emotions = (e.emotions || []).map(em => em.label).join("・");
        return `[${i + 1}] ${dateStr} エネルギー:${e.energy} 感情:${emotions || e.dominant}`;
      })
      .join("\n");

    const message = await createMessageWithRetry(client, {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: WEEKLY_SUMMARY_PROMPT,
      messages: [
        {
          role: "user",
          content: `今週の記録（${entries.length}件）:\n\n${entrySummary}`,
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("parse failed");

    const parsed = JSON.parse(jsonMatch[0]);
    const summary = typeof parsed.summary === "string" && parsed.summary.length > 0
      ? parsed.summary.slice(0, 300)
      : "";

    return NextResponse.json({ summary });
  } catch (error) {
    if (process.env.NODE_ENV === "development") console.error("weekly-summary error:", error);
    if (isRetryableError(error)) {
      return NextResponse.json(
        { error: "ただいま混み合っています。少し時間をおいてもう一度お試しください" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "生成に失敗しました" }, { status: 500 });
  }
}
