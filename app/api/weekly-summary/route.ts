import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateOrigin } from "@/lib/origin-check";
import { Entry } from "@/app/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const WEEKLY_SYSTEM_PROMPT = `あなたは「凪（Nagi）」です。ユーザーの今週の記録をまとめて、静かな振り返りのことばを届けます。

振り返りのことばについて:
- 文字数: 120〜180文字
- 語り口: 温かく、淡々とした「です・ます」調
- 感情の傾向や変化を穏やかに観察する
- 評価・判断・アドバイスはしない
- 週全体の流れ（エネルギーの上下、感情の変化）をそっと映し出す
- 感嘆符「！」は使わない

以下のJSON形式のみで返してください:
{"summary": "振り返りのことば"}`;

export async function POST(request: NextRequest) {
  try {
    const originError = validateOrigin(request);
    if (originError) return originError;

    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData?.claims) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
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

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: WEEKLY_SYSTEM_PROMPT,
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
    return NextResponse.json({ error: "生成に失敗しました" }, { status: 500 });
  }
}
