/**
 * 「書けない日のための最小入力」用の種文（seed）を生成する。
 *
 * 感情ラベルを 1 つ受け取り、入力カードの textarea に充填する自然文を返す。
 * 約 30 字に収め、/api/comment の短文ティア（50 字以下 → gentle・コメント 30〜50 字）に
 * 自然に乗せる。文面の調整はこのファイル 1 箇所で行う。
 */
export function buildMoodSeed(label: string): string {
  return `今日は、うまく言葉にできないけれど『${label}』が近い気持ちです。`;
}
