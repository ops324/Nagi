"use client";

/*
 * Google Fonts — app/layout.tsx に以下を追加:
 *
 *   import { Zen_Old_Mincho, Noto_Serif_JP } from "next/font/google";
 *
 *   const zenOldMincho = Zen_Old_Mincho({
 *     weight: ["400", "700"],
 *     subsets: ["latin"],
 *     variable: "--font-zen-old-mincho",
 *     display: "swap",
 *   });
 *   const notoSerifJP = Noto_Serif_JP({
 *     weight: ["300", "400", "500"],
 *     subsets: ["latin"],
 *     variable: "--font-noto-serif-jp",
 *     display: "swap",
 *   });
 *
 *   // body className に追加:
 *   // className={`${zenOldMincho.variable} ${notoSerifJP.variable} ...`}
 */

import { useState } from "react";
import type { Entry, Emotion } from "@/app/types";
import type { ReactNode } from "react";

export interface EntryCardProps {
  entry: Entry;
  emotionGradient: (emotions: Emotion[]) => string;
  EMOTION_COLORS: Record<string, string>;
  onToggleFavorite?: (id: string) => void;
  onNoteChange?: (id: string, value: string) => void;
  noteSaved?: boolean;
  /** ⋯ メニュー・削除確認などを差し込むスロット（日時の右隣） */
  menuSlot?: ReactNode;
  /** カレンダーナビゲーション時のハイライト */
  highlighted?: boolean;
  /** 投稿直後の新着グロー */
  isNew?: boolean;
  /** スクロールナビゲーション用 DOM id */
  domId?: string;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const ENERGY_DOT_COUNT = 10;

const KEYFRAMES = `
  @keyframes entryFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes deepBreath {
    0%, 100% { opacity: 0.25; }
    50%       { opacity: 0.55; }
  }
  @keyframes newEntryGlow {
    0%   { box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 30%, transparent); }
    60%  { box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 30%, transparent); }
    100% { box-shadow: none; }
  }
`;

export default function EntryCard({
  entry,
  emotionGradient,
  EMOTION_COLORS,
  onToggleFavorite,
  onNoteChange,
  noteSaved,
  menuSlot,
  highlighted = false,
  isNew = false,
  domId,
}: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const isDeep = entry.insightLevel === "deep";
  const gradient = emotionGradient(entry.emotions);
  const dominantColor = EMOTION_COLORS[entry.dominant] ?? "var(--green)";
  const shouldTruncate = entry.content.length > 110;

  return (
    <>
      <style>{KEYFRAMES}</style>

      <article
        id={domId}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          borderRadius: "var(--radius-lg)",
          backgroundColor: "var(--bg-card)",
          border: `1px solid ${
            highlighted
              ? "var(--tab-active)"
              : isDeep
              ? `color-mix(in srgb, ${dominantColor} 38%, var(--border))`
              : hovered
              ? "color-mix(in srgb, var(--text-muted) 20%, var(--border))"
              : "var(--border)"
          }`,
          overflow: "hidden",
          transition: `
            border-color var(--duration-normal) var(--easing-calm),
            box-shadow 0.35s cubic-bezier(0.4, 0, 0.2, 1),
            transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)
          `,
          transform: hovered ? "translateY(-2px)" : "translateY(0)",
          boxShadow: highlighted
            ? "0 0 0 3px color-mix(in srgb, var(--tab-active) 20%, transparent)"
            : hovered
            ? `0 16px 48px color-mix(in srgb, ${dominantColor} 10%, transparent),
               0 4px 16px color-mix(in srgb, var(--text-primary) 5%, transparent)`
            : "0 1px 4px color-mix(in srgb, var(--text-primary) 4%, transparent)",
          animation: isNew
            ? "entryFadeUp 0.45s cubic-bezier(0.4, 0, 0.2, 1) both, newEntryGlow 4s ease-out both"
            : "entryFadeUp 0.45s cubic-bezier(0.4, 0, 0.2, 1) both",
        }}
      >
        {/* Deep insight: 支配感情の色で静かに呼吸するアンビエントグロー */}
        {isDeep && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              background: `radial-gradient(ellipse 90% 50% at 15% -10%, color-mix(in srgb, ${dominantColor} 18%, transparent), transparent 65%)`,
              animation: "deepBreath 4.5s ease-in-out infinite",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}

        {/* ── 感情リボン（3px） ── */}
        <div
          aria-hidden="true"
          style={{
            height: "3px",
            background: gradient,
            opacity: hovered ? 1.0 : 0.85,
            filter: hovered ? "blur(0.8px)" : "none",
            position: "relative",
            zIndex: 1,
            transition: "opacity 0.5s ease, filter 0.5s ease",
          }}
        />

        {/* ── 水彩にじみ wash ── */}
        <div
          aria-hidden="true"
          style={{
            height: "88px",
            background: gradient,
            opacity: hovered ? 0.10 : 0.055,
            marginTop: "-3px",
            position: "relative",
            zIndex: 1,
            maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)",
            transition: "opacity 0.7s ease",
          }}
        />

        {/* ── カード本体 ── */}
        <div
          style={{
            padding: "6px 28px 28px",
            position: "relative",
            zIndex: 2,
            marginTop: "-22px",
          }}
        >

          {/* 日時 + お気に入り */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <time
              style={{
                fontFamily:
                  "var(--font-noto-serif-jp, 'Noto Serif JP', 'Hiragino Mincho ProN', serif)",
                fontSize: "11px",
                letterSpacing: "0.1em",
                color: "var(--text-muted)",
                fontWeight: 300,
              }}
            >
              {fmtDate(entry.createdAt)}
            </time>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {isDeep && (
                <span
                  style={{
                    fontFamily:
                      "var(--font-noto-serif-jp, 'Noto Serif JP', serif)",
                    fontSize: "10px",
                    letterSpacing: "0.18em",
                    color: dominantColor,
                    opacity: 0.8,
                  }}
                >
                  深い気づき
                </span>
              )}
              {menuSlot}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite?.(entry.id);
                }}
                aria-label={entry.isFavorited ? "お気に入りを解除" : "お気に入りに追加"}
                aria-pressed={entry.isFavorited}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: entry.isFavorited ? "#f0cc50" : "var(--text-muted)",
                  opacity: entry.isFavorited ? 1 : 0.4,
                  transition: "color 0.2s ease, opacity 0.2s ease, transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform = "scale(1.2) rotate(18deg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = entry.isFavorited ? "1" : "0.4";
                  e.currentTarget.style.transform = "scale(1) rotate(0deg)";
                }}
              >
                {/* 四芒星 ✦ */}
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 20 20"
                  fill={entry.isFavorited ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                >
                  <path d="M10 1.5 L11.8 8.2 L18.5 10 L11.8 11.8 L10 18.5 L8.2 11.8 L1.5 10 L8.2 8.2 Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* 本文 */}
          <div
            onClick={() => shouldTruncate && setExpanded(!expanded)}
            style={{
              fontFamily:
                "var(--font-zen-old-mincho, 'Zen Old Mincho', 'Noto Serif JP', 'Hiragino Mincho ProN', serif)",
              fontSize: "14px",
              lineHeight: "2",
              color: "var(--text-primary)",
              letterSpacing: "0.04em",
              cursor: shouldTruncate ? "pointer" : "default",
              overflow: "hidden",
              maxHeight: expanded || !shouldTruncate ? "9999px" : "5.6em",
              WebkitMaskImage:
                shouldTruncate && !expanded
                  ? "linear-gradient(to bottom, black 50%, transparent 100%)"
                  : "none",
              maskImage:
                shouldTruncate && !expanded
                  ? "linear-gradient(to bottom, black 50%, transparent 100%)"
                  : "none",
              transition: "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            {entry.content}
          </div>

          {/* 展開トグル */}
          {shouldTruncate && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 0 12px",
                fontSize: "11px",
                letterSpacing: "0.12em",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                opacity: 0.6,
                transition: "opacity var(--duration-fast) ease",
                fontFamily:
                  "var(--font-noto-serif-jp, 'Noto Serif JP', serif)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0.6";
              }}
            >
              {expanded ? "折りたたむ" : "続きを読む"}
              <svg
                width="9"
                height="9"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                style={{
                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.3s ease",
                }}
              >
                <path d="M2 3.5 L5 6.5 L8 3.5" />
              </svg>
            </button>
          )}

          {/* 感情チップ + エネルギーバー */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              flexWrap: "wrap",
              marginTop: shouldTruncate ? "0" : "16px",
              marginBottom: "24px",
            }}
          >
            {entry.emotions.map((em) => {
              const color = EMOTION_COLORS[em.label] ?? "var(--green)";
              return (
                <span
                  key={em.label}
                  style={{
                    fontFamily:
                      "var(--font-noto-serif-jp, 'Noto Serif JP', serif)",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    padding: "3px 10px 4px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
                    color,
                    border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                    fontWeight: 400,
                  }}
                >
                  {em.label}
                </span>
              );
            })}

            {/* エネルギーラベル + ドット列 */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontFamily: "var(--font-noto-serif-jp, 'Noto Serif JP', serif)",
                  fontSize: "10px",
                  letterSpacing: "0.12em",
                  color: "var(--text-muted)",
                }}
              >
                エネルギー
              </span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "3px" }}
                title={`エネルギー ${entry.energy} / 10`}
                role="img"
                aria-label={`エネルギーレベル: ${entry.energy} / 10`}
              >
                {Array.from({ length: ENERGY_DOT_COUNT }, (_, i) => {
                const filled = i < entry.energy;
                return (
                  <div
                    key={i}
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      backgroundColor: filled ? dominantColor : "var(--border)",
                      opacity: filled ? 0.45 + (i / 9) * 0.55 : 0.4,
                      transition: "background-color 0.3s ease",
                    }}
                  />
                );
                })}
              </div>
            </div>
          </div>

          {/* ── 凪 区切り線（シンプル） ── */}
          <div
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                background:
                  "linear-gradient(to right, transparent, var(--border-inner))",
              }}
            />
            <span
              style={{
                fontFamily:
                  "var(--font-zen-old-mincho, 'Zen Old Mincho', 'Noto Serif JP', serif)",
                fontSize: "11px",
                letterSpacing: "0.25em",
                color: `color-mix(in srgb, ${dominantColor} 70%, var(--text-muted))`,
                fontWeight: 400,
                lineHeight: 1,
                opacity: 0.7,
              }}
            >
              凪
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                background:
                  "linear-gradient(to left, transparent, var(--border-inner))",
              }}
            />
          </div>

          {/* 凪のことば */}
          <p
            style={{
              fontFamily:
                "var(--font-noto-serif-jp, 'Noto Serif JP', 'Hiragino Mincho ProN', serif)",
              fontSize: "13px",
              lineHeight: "2.15",
              color: "var(--text-secondary)",
              letterSpacing: "0.055em",
              fontWeight: 300,
              margin: 0,
              paddingLeft: "2px",
            }}
          >
            {entry.comment}
          </p>

          {/* 余韻メモ */}
          <div style={{ marginTop: "20px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.2em",
                  color: "var(--text-faint)",
                  fontFamily:
                    "var(--font-noto-serif-jp, 'Noto Serif JP', serif)",
                }}
              >
                余韻メモ
              </span>
              {noteSaved && (
                <span
                  style={{
                    fontSize: "9px",
                    letterSpacing: "0.1em",
                    color: "var(--green)",
                    opacity: 0.7,
                  }}
                >
                  保存済み
                </span>
              )}
            </div>
            <textarea
              value={entry.note ?? ""}
              onChange={(e) => onNoteChange?.(entry.id, e.target.value)}
              readOnly={!onNoteChange}
              placeholder="読み返したとき、何か残しておきたいことがあれば…"
              rows={2}
              style={{
                width: "100%",
                resize: "none",
                outline: "none",
                background: "transparent",
                border: "none",
                borderTop: "1px solid var(--border-inner)",
                paddingTop: "10px",
                fontFamily:
                  "var(--font-noto-serif-jp, 'Noto Serif JP', serif)",
                fontSize: "12px",
                lineHeight: "1.9",
                letterSpacing: "0.04em",
                color: "var(--text-secondary)",
                fontWeight: 300,
                cursor: onNoteChange ? "text" : "default",
              }}
            />
          </div>
        </div>
      </article>
    </>
  );
}
