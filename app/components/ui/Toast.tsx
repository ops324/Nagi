"use client";

interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** 単一インスタンスの軽量トースト（画面下部中央） */
export default function Toast({ message, actionLabel, onAction }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 z-50 toast-in"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
    >
      <div
        className="flex items-center gap-4 rounded-full pl-5 pr-2 py-2 shadow-md"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <span className="text-xs tracking-wide" style={{ color: "var(--text-secondary)" }}>
          {message}
        </span>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="text-xs tracking-widest px-3 py-1.5 rounded-full transition-colors"
            style={{ color: "var(--green)" }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
