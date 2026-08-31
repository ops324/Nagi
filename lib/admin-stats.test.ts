import { describe, expect, it } from "vitest";
import { contentLenDistribution } from "./admin-stats";

const counts = (lengths: number[]) =>
  Object.fromEntries(contentLenDistribution(lengths).map((d) => [d.range, d.count]));

describe("contentLenDistribution", () => {
  it("記録がなければ全バケットが 0", () => {
    expect(contentLenDistribution([])).toEqual([
      { range: "〜50字", count: 0 },
      { range: "51〜150字", count: 0 },
      { range: "151〜300字", count: 0 },
      { range: "301字〜", count: 0 },
    ]);
  });

  it("境界値がひとつ下のバケットに入る（50/150/300 は上限側）", () => {
    expect(counts([50, 150, 300])).toEqual({
      "〜50字": 1,
      "51〜150字": 1,
      "151〜300字": 1,
      "301字〜": 0,
    });
  });

  it("境界の直後は次のバケットに移る", () => {
    expect(counts([51, 151, 301])).toEqual({
      "〜50字": 0,
      "51〜150字": 1,
      "151〜300字": 1,
      "301字〜": 1,
    });
  });

  it("0 文字は最小バケットに入る（どのバケットからも漏れない）", () => {
    expect(counts([0])).toEqual({
      "〜50字": 1,
      "51〜150字": 0,
      "151〜300字": 0,
      "301字〜": 0,
    });
  });

  it("バケットの合計は入力件数と一致する（重複計上も取りこぼしもない）", () => {
    const lengths = [0, 1, 50, 51, 149, 150, 151, 299, 300, 301, 5000];
    const total = contentLenDistribution(lengths).reduce((s, d) => s + d.count, 0);
    expect(total).toBe(lengths.length);
  });

  // content_len が取得できなかった場合（select 漏れ・列名変更）に
  // 黙って分布から消えると、過少な分布が正常に見えてしまう。
  it("数値でない長さを取りこぼさない（NaN・undefined は 0 として数える）", () => {
    const lengths = [NaN, undefined as unknown as number, 10];
    const dist = contentLenDistribution(lengths);
    expect(dist.reduce((s, d) => s + d.count, 0)).toBe(lengths.length);
    expect(counts(lengths)).toEqual({
      "〜50字": 3,
      "51〜150字": 0,
      "151〜300字": 0,
      "301字〜": 0,
    });
  });

  it("バケットの順序と表示名は固定（グラフの並びが入れ替わらない）", () => {
    expect(contentLenDistribution([]).map((d) => d.range)).toEqual([
      "〜50字",
      "51〜150字",
      "151〜300字",
      "301字〜",
    ]);
  });
});
