"use client";

import { EMOTION_COLORS } from "../types";

export interface MoodOrbPickerProps {
  /** オーブを選択したとき（感情ラベルを渡す） */
  onSelect: (label: string) => void;
}

/**
 * 「書けない日のための最小入力」用の感情オーブ群（カラーの円＋下ラベル）。
 * EMOTION_COLORS の 12 種を 4 列グリッドで描画する表示専用コンポーネント。
 * 表示/非表示・展開アニメは呼び出し側（InputCard）が制御する。
 */
export default function MoodOrbPicker({ onSelect }: MoodOrbPickerProps) {
  const labels = Object.keys(EMOTION_COLORS);
  return (
    <div>
      <p
        className="text-sm text-center leading-relaxed mb-4"
        style={{ color: "var(--text-muted)", fontStyle: "italic" }}
      >
        近い気持ちに、そっと触れてください
      </p>
      <div className="grid grid-cols-4 gap-x-2 gap-y-4">
        {labels.map((label) => (
          <button
            key={label}
            onClick={() => onSelect(label)}
            aria-label={`${label}で記録を始める`}
            className="flex flex-col items-center gap-2 rounded-2xl py-1 transition-transform active:scale-95"
            style={{ backgroundColor: "transparent" }}
          >
            <span
              className="w-[42px] h-[42px] rounded-full flex-shrink-0"
              style={{ backgroundColor: EMOTION_COLORS[label], boxShadow: "var(--shadow-1)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
