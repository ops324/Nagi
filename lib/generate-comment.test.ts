import { beforeEach, describe, expect, it, vi } from "vitest";

// Anthropic 呼び出しはモックし、JSON抽出・スキーマ検証・ティア判定のみを検証する。
const createMessageWithRetry = vi.fn();
vi.mock("@/lib/anthropic-retry", () => ({
  createMessageWithRetry: (...args: unknown[]) => createMessageWithRetry(...args),
  isRetryableError: () => false,
}));

import { FALLBACK_COMMENT, generateComment } from "@/lib/generate-comment";

// AI 応答テキストを返すヘルパ（text ブロック1つ）
function mockResponse(text: string) {
  createMessageWithRetry.mockResolvedValueOnce({
    content: [{ type: "text", text }],
  });
}

beforeEach(() => {
  createMessageWithRetry.mockReset();
});

describe("generateComment - 正常系", () => {
  it("妥当な JSON を各フィールドへマップする", async () => {
    mockResponse(
      JSON.stringify({
        comment: "静かに見つめています。",
        emotions: [
          { label: "穏やか", score: 0.8 },
          { label: "希望", score: 0.4 },
        ],
        dominant: "穏やか",
        energy: 6,
        insight_level: "deep",
      })
    );
    const result = await generateComment("おだやかな一日でした");
    expect(result).toEqual({
      comment: "静かに見つめています。",
      emotions: [
        { label: "穏やか", score: 0.8 },
        { label: "希望", score: 0.4 },
      ],
      dominant: "穏やか",
      energy: 6,
      insightLevel: "deep",
    });
  });

  it("コメントは300文字に切り詰める", async () => {
    const long = "あ".repeat(400);
    mockResponse(JSON.stringify({ comment: long }));
    const result = await generateComment("test");
    expect(result.comment).toHaveLength(300);
  });

  it("前後に文字がある JSON も抽出できる", async () => {
    mockResponse('余計な前置き {"comment":"抽出できました","energy":7} 余計な後書き');
    const result = await generateComment("test");
    expect(result.comment).toBe("抽出できました");
    expect(result.energy).toBe(7);
  });
});

describe("generateComment - スキーマ検証/フォールバック", () => {
  it("コメントが空・欠落なら FALLBACK_COMMENT", async () => {
    mockResponse(JSON.stringify({ comment: "   " }));
    expect((await generateComment("t")).comment).toBe(FALLBACK_COMMENT);
  });

  it("不正な感情ラベル・範囲外スコアは除外する", async () => {
    mockResponse(
      JSON.stringify({
        emotions: [
          { label: "穏やか", score: 0.5 },
          { label: "存在しない感情", score: 0.5 },
          { label: "希望", score: 1.5 }, // 範囲外
          { label: "感謝", score: "高い" }, // 型不正
        ],
      })
    );
    const result = await generateComment("t");
    expect(result.emotions).toEqual([{ label: "穏やか", score: 0.5 }]);
  });

  it("感情は最大3つに制限する", async () => {
    mockResponse(
      JSON.stringify({
        emotions: [
          { label: "喜び", score: 0.9 },
          { label: "穏やか", score: 0.8 },
          { label: "希望", score: 0.7 },
          { label: "充実", score: 0.6 },
        ],
      })
    );
    expect((await generateComment("t")).emotions).toHaveLength(3);
  });

  it("dominant 不正時は最有力感情へ、感情もなければ穏やかへ", async () => {
    mockResponse(JSON.stringify({ emotions: [{ label: "希望", score: 0.6 }], dominant: "不正" }));
    expect((await generateComment("t")).dominant).toBe("希望");

    mockResponse(JSON.stringify({ dominant: "不正", emotions: [] }));
    expect((await generateComment("t")).dominant).toBe("穏やか");
  });

  it("energy は 1〜10 の整数のみ採用、それ以外は 5", async () => {
    mockResponse(JSON.stringify({ energy: 5.5 }));
    expect((await generateComment("t")).energy).toBe(5);
    mockResponse(JSON.stringify({ energy: 0 }));
    expect((await generateComment("t")).energy).toBe(5);
    mockResponse(JSON.stringify({ energy: 11 }));
    expect((await generateComment("t")).energy).toBe(5);
    mockResponse(JSON.stringify({ energy: 8 }));
    expect((await generateComment("t")).energy).toBe(8);
  });

  it("insight_level 不正時は moderate", async () => {
    mockResponse(JSON.stringify({ insight_level: "unknown" }));
    expect((await generateComment("t")).insightLevel).toBe("moderate");
  });

  it("JSON が無い／壊れていても穏当な既定値を返す", async () => {
    mockResponse("ただのテキストで JSON がありません");
    const noJson = await generateComment("t");
    expect(noJson.comment).toBe(FALLBACK_COMMENT);
    expect(noJson.dominant).toBe("穏やか");
    expect(noJson.energy).toBe(5);
    expect(noJson.insightLevel).toBe("moderate");

    mockResponse("{ comment: 壊れたJSON ");
    expect((await generateComment("t")).comment).toBe(FALLBACK_COMMENT);
  });
});

describe("generateComment - 入力長によるティア判定", () => {
  function lastMaxTokens(): number {
    const call = createMessageWithRetry.mock.calls.at(-1);
    return (call?.[1] as { max_tokens: number }).max_tokens;
  }

  it("短文(<=50字)は max_tokens=300", async () => {
    mockResponse("{}");
    await generateComment("あ".repeat(50));
    expect(lastMaxTokens()).toBe(300);
  });

  it("中文(51〜150字)は max_tokens=500", async () => {
    mockResponse("{}");
    await generateComment("あ".repeat(100));
    expect(lastMaxTokens()).toBe(500);
  });

  it("長文(>150字)は max_tokens=800", async () => {
    mockResponse("{}");
    await generateComment("あ".repeat(200));
    expect(lastMaxTokens()).toBe(800);
  });
});
