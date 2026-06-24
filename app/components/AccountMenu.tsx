"use client";

import { logout } from "../auth/actions";

export interface AccountMenuProps {
  /** 表示状態 */
  open: boolean;
  /** ヘッダに表示するログインユーザーのメールアドレス */
  userEmail: string | null;
  /** 閉じる（オーバーレイ／アカウント設定リンクの操作で呼ぶ） */
  onClose: () => void;
}

/**
 * アカウントメニュー（ボトムシート）。
 * HomeClient から切り出した表示専用コンポーネント。挙動・見た目は従来と不変。
 */
export default function AccountMenu({ open, userEmail, onClose }: AccountMenuProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="アカウントメニュー"
      className="fixed inset-0 z-50 account-sheet-overlay"
      onClick={onClose}
    >
      <div
        className="absolute bottom-0 left-0 right-0 account-sheet"
        style={{
          backgroundColor: "var(--bg-card)",
          borderRadius: "1.5rem 1.5rem 0 0",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom, 1.5rem)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ドラッグハンドル */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-6"
          style={{ backgroundColor: "var(--border)" }} />

        {/* ユーザー情報 */}
        <div className="flex items-center gap-3 px-6 mb-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--green-light)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--color-btn-text)" }}>
              {userEmail?.[0]?.toUpperCase()}
            </span>
          </div>
          <p className="text-sm truncate" style={{ color: "var(--text-secondary)" }}>
            {userEmail}
          </p>
        </div>

        {/* アカウント設定リンク */}
        <a
          href="/account"
          className="flex items-center justify-between px-6 py-3.5"
          style={{ borderTop: "1px solid var(--border-inner)" }}
          onClick={onClose}
        >
          <span className="text-sm tracking-wide" style={{ color: "var(--text-secondary)" }}>
            アカウント設定
          </span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: "var(--text-muted)" }}>
            <path d="M4.5 2.5L8 6l-3.5 3.5"/>
          </svg>
        </a>

        {/* ログアウト */}
        <div className="px-6 pt-2 pb-6"
          style={{ borderTop: "1px solid var(--border-inner)" }}>
          <form action={logout}>
            <button
              type="submit"
              className="logout-ripple-btn w-full mt-4 py-3.5 rounded-2xl text-sm tracking-widest"
              style={{
                backgroundColor: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
              onPointerDown={(e) => {
                const btn = e.currentTarget;
                const rect = btn.getBoundingClientRect();
                const span = document.createElement("span");
                span.className = "ripple";
                span.style.top = `${e.clientY - rect.top}px`;
                span.style.left = `${e.clientX - rect.left}px`;
                btn.appendChild(span);
                span.addEventListener("animationend", () => span.remove());
              }}
            >
              ログアウト
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
