"use client";

import { Entry, Emotion } from "../types";

export interface MemoryCardProps {
  /** 対象記録（メモリー判定に使用） */
  entries: Entry[];
  /** 感情グラデーション生成 */
  emotionGradient: (emotions: Emotion[]) => string;
  /** タップでその記録へ移動 */
  onNavigate: (entry: Entry) => void;
}

/**
 * あの日の凪（A-1）。1年前／半年前／ひと月前の同じ日に記録があれば
 * カードとして表示し、タップでその記録へ移動する。該当なしなら null。
 * HomeClient から切り出した表示専用コンポーネント。挙動・見た目は従来と不変。
 */
export default function MemoryCard({ entries, emotionGradient, onNavigate }: MemoryCardProps) {
  const getMemoryEntry = (): { entry: Entry; label: string } | null => {
    const now = new Date();
    const targets = [
      { months: 12, label: "1年前の今日" },
      { months: 6,  label: "半年前の今日" },
      { months: 1,  label: "ひと月前の今日" },
    ];
    for (const { months, label } of targets) {
      const target = new Date(now);
      target.setMonth(target.getMonth() - months);
      const found = entries.find(e => {
        const d = new Date(e.createdAt);
        return d.getFullYear() === target.getFullYear()
            && d.getMonth()    === target.getMonth()
            && d.getDate()     === target.getDate();
      });
      if (found) return { entry: found, label };
    }
    return null;
  };

  const memory = getMemoryEntry();
  if (!memory) return null;
  return (
    <button
      onClick={() => onNavigate(memory.entry)}
      className="w-full text-left rounded-3xl p-[22px] transition-opacity"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px dashed var(--border)",
        opacity: 0.75,
      }}
      aria-label={`${memory.label}の記録を見る`}
    >
      <p className="text-xs tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>{memory.label}</p>
      {memory.entry.emotions?.length > 0 && (
        <div className="h-px rounded-full w-full mb-3"
          style={{ background: emotionGradient(memory.entry.emotions) }} />
      )}
      <p className="text-sm leading-relaxed overflow-hidden"
        style={{
          color: "var(--text-muted)",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
        }}>
        {memory.entry.content}
      </p>
    </button>
  );
}
