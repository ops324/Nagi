import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT } from "@/prompts/system-prompt";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "内容が空です" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `ユーザーの記録：\n${content}`,
        },
      ],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // JSONを抽出
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("JSON parse failed");
    }
    const result = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      comment: result.comment || "",
      emotions: result.emotions || [],
      dominant: result.dominant || "穏やか",
      energy: result.energy || 5,
      insightLevel: result.insight_level || "moderate",
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "コメントの生成に失敗しました" },
      { status: 500 }
    );
  }
}
