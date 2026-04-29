export type Emotion = {
  label: string;
  score: number;
};

export type Entry = {
  id: string;
  content: string;
  comment: string;
  emotions: Emotion[];
  dominant: string;
  energy: number;
  createdAt: string;
  insightLevel?: "deep" | "moderate" | "gentle";
  note?: string;
};

// 感情の価値（valence）×彩度で色を設計するパレット
// ポジティブ感情は彩度↑明度↑、ネガティブ感情は彩度↓で落ち着いた配色
// → 喜びのとき画面が明るく感じられ、辛いときは穏やかに包む
export const EMOTION_COLORS: Record<string, string> = {
  // ── ポジティブ（明るい・彩度高め）── 6種
  喜び:   "#f0cc50",  // bright gold       — 鮮やかな黄金。喜びを素直に明るく
  希望:   "#f0a84e",  // bright amber      — 明るいアンバー。前向きなエネルギー
  充実:   "#5ec89a",  // vivid seafoam     — 鮮やかなシーフォーム。満たされた活力
  穏やか: "#58c090",  // vivid sage        — 明るいセージ。安心感と清々しさ
  感謝:   "#e8c06e",  // warm golden       — 温かみのある金色。感謝のぬくもり
  安心:   "#7ecfc4",  // soft teal         — 柔らかいティール。心が落ち着く感覚
  // ── ネガティブ／重い（落ち着いた・彩度低め）── 6種
  不安:   "#9698c4",  // muted periwinkle  — くすんだ青紫。不安を鎮静方向に
  悲しみ: "#78aac8",  // muted cerulean    — 霞んだ空色。静かな悲しみ
  怒り:   "#c49494",  // muted dusty rose  — くすんだローズ。怒りを柔らかく包む
  疲れ:   "#b8b4ae",  // warm stone        — 温かみのある灰。消耗・停止
  混乱:   "#a8a0c8",  // soft violet       — 柔らかい菫色。混乱の中の静けさ
  孤独:   "#8898b0",  // steel slate       — 落ち着いたスレート。内省的な孤独
};

export const EMOTION_TEXT: Record<string, string> = {
  喜び:   "#b45309",
  穏やか: "#065f46",
  不安:   "#5b21b6",
  悲しみ: "#1d4ed8",
  怒り:   "#b91c1c",
  疲れ:   "#57534e",
  混乱:   "#6d28d9",
  希望:   "#c2410c",
  孤独:   "#334155",
  充実:   "#14532d",
  感謝:   "#92400e",
  安心:   "#134e4a",
};
