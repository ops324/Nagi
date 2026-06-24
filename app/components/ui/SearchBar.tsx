"use client";

interface SearchBarProps {
  /** 検索クエリ（制御された値） */
  value: string;
  /** クエリ変更（入力・クリア） */
  onChange: (value: string) => void;
}

/**
 * 記録一覧の全文検索バー（アイコン＋入力＋クリアボタン）。
 * HomeClient から切り出した表示専用コンポーネント。挙動・見た目は従来と不変。
 * 表示条件（記録が1件以上）は呼び出し側で制御する。
 */
export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
        style={{ color: "var(--text-faint)" }}
        fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="記録を検索…"
        className="w-full pl-9 pr-4 py-2 rounded-2xl text-sm font-light outline-none transition-all"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          color: "var(--text-main)",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="検索をクリア"
          className="btn-ghost absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full"
          style={{ color: "var(--text-muted)" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
