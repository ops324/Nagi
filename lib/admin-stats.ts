// 戻り値の型は app/admin/types.ts の ContentLenDist と同形。
// lib は純ロジック層なので app への依存は持たない（構造が同じなので代入互換）。
export type ContentLenBucket = { range: string; count: number };

/**
 * 記録本文の文字数分布を求める（v1.89.0）。
 *
 * 入力は本文そのものではなく **長さの配列**。管理ダッシュボードは
 * `admin_entry_stats` ビューから `content_len`（DB 側の `char_length()`）を受け取り、
 * 日記本文をアプリへ持ち込まない（docs/supabase-setup.sql 19.）。
 *
 * 境界は「〜50 / 51〜150 / 151〜300 / 301〜」。旧実装（JS の `content.length`）と
 * 同じ区切りだが、**絵文字を含む記録では結果が変わりうる**：
 * JS の `.length` は UTF-16 コード単位、Postgres の `char_length()` は**コードポイント数**を
 * 数えるため、サロゲートペアの絵文字が 2 → 1 になる。ラベルが「字」である以上、後者のほうが
 * 表示の意味に合う（意図的な変更）。なお ZWJ で結合した絵文字は
 * どちらでも 1 にはならない（👨‍👩‍👧‍👦 は `.length` 11 / `char_length` 7）。
 *
 * 数値でない長さ（NaN・undefined）は 0 として扱う。素の比較のままだと
 * **どのバケットにも入らず黙って消える**ため、合計が入力件数と合わなくなる
 * ＝分布が過少になっていることに気づけない。0 に寄せれば最小バケットへの
 * 偏りとして現れる（取得側の異常は app/admin/page.tsx の logError が拾う）。
 */
export function contentLenDistribution(lengths: number[]): ContentLenBucket[] {
  const buckets: { range: string; test: (n: number) => boolean }[] = [
    { range: "〜50字", test: (n) => n <= 50 },
    { range: "51〜150字", test: (n) => n > 50 && n <= 150 },
    { range: "151〜300字", test: (n) => n > 150 && n <= 300 },
    { range: "301字〜", test: (n) => n > 300 },
  ];
  // Number.isFinite で正規化してから分類する（非有限値を取りこぼさない）。
  // filter に b.test を直接渡さないのは、Array.prototype.filter が
  // (value, index, array) を渡すため、将来 test を多引数化したときに
  // index が黙って第2引数に入る事故を防ぐため。
  const normalized = lengths.map((n) => (Number.isFinite(n) ? n : 0));
  return buckets.map((b) => ({
    range: b.range,
    count: normalized.filter((n) => b.test(n)).length,
  }));
}
