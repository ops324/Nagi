"use client";

import { useEffect, useRef, useState } from "react";

interface TabItem {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  ariaLabel?: string;
  /** 指定すると id=`tab-${key}` / aria-controls=`panel-${key}` を付与（パネルとの関連付け用） */
  withPanels?: boolean;
  /** コンテナへ追加する className（余白など） */
  className?: string;
}

/**
 * 下線がアクティブタブへ滑って移動するタブバー。
 * 各タブの実寸（offsetLeft / offsetWidth）を測ってインジケータを配置するため、
 * 可変幅・左寄せのタブでも正しく追従する。初回配置はアニメーションさせない。
 */
export default function TabBar({
  tabs,
  active,
  onChange,
  ariaLabel,
  withPanels = false,
  className = "",
}: TabBarProps) {
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [armed, setArmed] = useState(false); // 初回配置後にトランジションを有効化

  useEffect(() => {
    const measure = () => {
      const b = btnRefs.current[active];
      if (!b) return;
      setIndicator({ left: b.offsetLeft, width: b.offsetWidth });
    };
    measure();
    // 初回フレーム後にアニメーションを許可（初期表示で下線が伸びてこないように）
    const raf = requestAnimationFrame(() => setArmed(true));
    window.addEventListener("resize", measure);
    // フォント読み込み後に幅が変わるケースへ追従
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(measure).catch(() => {});
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [active, tabs]);

  return (
    <div className={`relative flex gap-5 ${className}`} role="tablist" aria-label={ariaLabel}>
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          ref={(el) => {
            btnRefs.current[key] = el;
          }}
          role="tab"
          aria-selected={active === key}
          aria-controls={withPanels ? `panel-${key}` : undefined}
          id={withPanels ? `tab-${key}` : undefined}
          onClick={() => onChange(key)}
          className="pb-3 text-xs tracking-widest transition-colors"
          style={{ color: active === key ? "var(--text-secondary)" : "var(--text-muted)" }}
        >
          {label}
        </button>
      ))}
      <span
        aria-hidden="true"
        className="tab-indicator"
        style={{
          transform: `translateX(${indicator.left}px)`,
          width: indicator.width,
          transition: armed ? undefined : "none",
        }}
      />
    </div>
  );
}
