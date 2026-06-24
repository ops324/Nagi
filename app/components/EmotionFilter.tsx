"use client";

import { Entry, EMOTION_COLORS } from "../types";

export interface EmotionFilterProps {
  /** フィルタ対象の記録一覧（チップの導出に使用） */
  entries: Entry[];
  /** 選択中のフィルタ（null=すべて / 感情ラベル / "✦"=お気に入り / "deep"=深い気づき） */
  filterKey: string | null;
  /** フィルタ変更 */
  onChange: (key: string | null) => void;
}

/**
 * 記録一覧の感情フィルター（横スクロールのチップ群）。
 * HomeClient から切り出した表示専用コンポーネント。挙動・見た目は従来と不変。
 * チップ種別（感情ラベル・お気に入り・深い気づき）は entries から導出し、
 * 表示するものが何もなければ null を返す。
 */
export default function EmotionFilter({ entries, filterKey, onChange }: EmotionFilterProps) {
  const availableEmotions = Array.from(
    new Set(entries.flatMap(e => e.emotions?.map(em => em.label) ?? []))
  );
  const hasFavorites = entries.some(e => e.isFavorited);
  const hasDeep = entries.some(e => e.insightLevel === "deep");
  if (availableEmotions.length === 0 && !hasFavorites && !hasDeep) return null;
  return (
    <div className="overflow-x-auto pb-1 -mx-1 px-1">
      <div className="flex gap-2 w-max">
        <button
          onClick={() => onChange(null)}
          className="text-xs px-3 py-1.5 rounded-full transition-all flex-shrink-0"
          style={{
            border: `1px solid ${filterKey === null ? "var(--tab-active)" : "var(--border)"}`,
            color: filterKey === null ? "var(--tab-active)" : "var(--text-muted)",
            backgroundColor: filterKey === null ? "color-mix(in srgb, var(--tab-active) 10%, transparent)" : "transparent",
          }}
        >
          すべて
        </button>
        {availableEmotions.map(label => (
          <button
            key={label}
            onClick={() => onChange(filterKey === label ? null : label)}
            className="text-xs px-3 py-1.5 rounded-full transition-all flex-shrink-0 flex items-center gap-1.5"
            style={{
              border: `1px solid ${filterKey === label ? (EMOTION_COLORS[label] || "#6ee7b7") : "var(--border)"}`,
              color: filterKey === label ? (EMOTION_COLORS[label] || "#6ee7b7") : "var(--text-muted)",
              backgroundColor: filterKey === label ? (EMOTION_COLORS[label] || "#6ee7b7") + "18" : "transparent",
              opacity: filterKey !== null && filterKey !== label ? 0.5 : 1,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: EMOTION_COLORS[label] || "#6ee7b7" }} />
            {label}
          </button>
        ))}
        {hasFavorites && (
          <button
            onClick={() => onChange(filterKey === "✦" ? null : "✦")}
            className="text-xs px-3 py-1.5 rounded-full transition-all flex-shrink-0"
            style={{
              border: `1px solid ${filterKey === "✦" ? "var(--tab-active)" : "var(--border)"}`,
              color: filterKey === "✦" ? "var(--tab-active)" : "var(--text-muted)",
              backgroundColor: filterKey === "✦" ? "color-mix(in srgb, var(--tab-active) 10%, transparent)" : "transparent",
            }}
          >
            ✦ お気に入り
          </button>
        )}
        {hasDeep && (
          <button
            onClick={() => onChange(filterKey === "deep" ? null : "deep")}
            className="text-xs px-3 py-1.5 rounded-full transition-all flex-shrink-0"
            style={{
              border: `1px solid ${filterKey === "deep" ? "var(--tab-active)" : "var(--border)"}`,
              color: filterKey === "deep" ? "var(--tab-active)" : "var(--text-muted)",
              backgroundColor: filterKey === "deep" ? "color-mix(in srgb, var(--tab-active) 10%, transparent)" : "transparent",
            }}
          >
            深い気づき
          </button>
        )}
      </div>
    </div>
  );
}
