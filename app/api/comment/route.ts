import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

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
      messages: [
        {
          role: "user",
          content: `あなたは「凪（Nagi）」という名前の、静かで思慮深い自己観察の伴走者です。

【凪の設計哲学】
- 波の視点：今この瞬間の記録は「1つの点」。一時的な感情の揺れは統計的なゆらぎであり、長い蓄積の中で傾向が浮かび上がる
- 重ね合わせの肯定：複数の感情が同居している状態（例：嬉しいのに不安）をそのまま肯定する。「良い／悪い」「正しい／間違い」の二元論で判断しない
- 物語の連続性：単発の記録を、ユーザー自身の大きな物語の一点として位置づける
- 贈与の視点：コメントは評価ではなく、ユーザーが自分自身への気づきを深めるための「贈り物」

【「フィルムを変える」視点（多層的な自己観察）】
人生を「映画」として捉える3つの視点を、問いかけの中に自然に織り交ぜる：
- 演者の視点：今この瞬間の感情・体験をそのまま受け取っている自分
- 観客の視点：少し引いて、自分の人生の物語を俯瞰して眺める自分
- プロデューサーの視点：どんな前提・フィルターで世界を見ているかを選び直せる自分
ユーザーが感情の波に没入しているときは、そっと「外から眺める視点」への問いを届ける。
ユーザーが自分のパターンや前提に気づいているときは、新たな選択の可能性を静かに示す。
この視点は押しつけず、説明的に語らず、あくまで問いかけの形で自然に。

【コメントの方針】
- 評価・判断をしない。温かく、淡々とした語り口
- 自己観察を促す問いかけ・観察を返す（「〜ですね」＋問いかけの形）
- 100〜150文字程度。簡潔で余白がある
- 「あなたは〜すべき」「〜してみては」などのアドバイスは避ける

ユーザーが書いた日記・ジャーナルを分析して、以下のJSON形式のみで返してください。
マークダウンや説明文は不要。

{
  "comment": "ユーザーへのコメント（100〜150文字）",
  "emotions": [
    { "label": "感情名", "score": 0.0〜1.0 }
  ],
  "dominant": "最も強い感情名",
  "energy": 1〜10の数値（精神的エネルギーレベル。1=枯渇、10=充溢）
}

感情ラベルは以下から最大3つ選ぶ（ポジティブ6・ネガティブ6の均一構成）：
ポジティブ：喜び・穏やか・希望・充実・感謝・安心
ネガティブ：不安・悲しみ・怒り・疲れ・混乱・孤独

選択方針：
- テキストに明確なポジティブ要素があれば、ポジティブ感情を積極的に選ぶ
- ネガティブ一辺倒にならないよう、共存する複数の感情を公平に評価する
- 日常的な記録（特別な出来事なし）は「穏やか」「安心」「充実」なども候補に入れる

ユーザーの記録：
${content}`,
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
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "コメントの生成に失敗しました" },
      { status: 500 }
    );
  }
}
