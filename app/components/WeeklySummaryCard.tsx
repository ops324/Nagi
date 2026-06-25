"use client";

import { Entry } from "../types";

export interface WeeklySummaryCardProps {
  /** 今週件数のゲート判定に使用 */
  entries: Entry[];
  /** 生成済みサマリー（あれば本文表示） */
  summary: string | null;
  /** 生成中（ボタン無効化） */
  loading: boolean;
  /** 「今週のことばを聞く」押下 */
  onRequestSummary: () => void;
}

/**
 * 今週の凪（A-2）。今週の記録が3件以上たまると現れるカード。
 * 未生成時は「今週のことばを聞く」ボタン、生成後はサマリー本文を緑の左罫線付きで表示。
 * 今週3件未満かつ未生成なら null。
 * HomeClient から切り出した表示専用コンポーネント。挙動・見た目は従来と不変。
 */
export default function WeeklySummaryCard({ entries, summary, loading, onRequestSummary }: WeeklySummaryCardProps) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const thisWeekCount = entries.filter(e => new Date(e.createdAt) >= weekStart).length;
  if (thisWeekCount < 3 && !summary) return null;
  return (
    <div className="rounded-3xl p-[22px]"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>今週の凪</span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-inner)" }} />
      </div>
      {summary ? (
        <p className="text-sm leading-relaxed"
          style={{
            color: "var(--text-secondary)",
            fontStyle: "italic",
            borderLeft: "2px solid color-mix(in srgb, var(--green) 60%, transparent)",
            paddingLeft: "12px",
          }}>
          {summary}
        </p>
      ) : (
        <button
          onClick={onRequestSummary}
          disabled={loading}
          className="text-xs tracking-widest transition-opacity"
          style={{ color: "var(--text-muted)", opacity: loading ? 0.5 : 1 }}
        >
          {loading ? "読んでいます…" : "今週のことばを聞く"}
        </button>
      )}
    </div>
  );
}
