"use client";

import { useState } from "react";
import { spawnRipple } from "../lib/ripple";
import MoodOrbPicker from "./MoodOrbPicker";

const PHASE_LABELS = ["読んでいます", "感じています", "ことばを選んでいます"] as const;

export interface InputCardProps {
  /** textarea の入力値（下書き） */
  content: string;
  /** 送信中（ローディング演出を表示） */
  loading: boolean;
  /** ローディングのフェーズ（0〜2／PHASE_LABELS の添字） */
  loadingPhase: number;
  /** ローディング中に表示する問いかけ（なければ null） */
  loadingQuestion: string | null;
  /** エラーメッセージ（空文字なら非表示） */
  error: string;
  /** 入力変更（下書き保存は呼び出し側） */
  onContentChange: (value: string) => void;
  /** キー押下（⌘/Ctrl+Enter 送信は呼び出し側） */
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** 「記録する」押下 */
  onSubmit: () => void;
  /** 感情オーブ選択時（最小入力：種文を content へ充填）。未指定なら入口を出さない */
  onMoodSelect?: (label: string) => void;
}

/**
 * 今日の記録の入力カード（見出し＋ローディング演出＋textarea＋問いかけ＋
 * エラー＋文字数カウンタ＋「記録する」ボタン）。
 * HomeClient から切り出した表示専用コンポーネント。挙動・見た目は従来と不変。
 * 送信・下書き保存・ローディングフェーズ管理のロジックは呼び出し側に残置。
 */
export default function InputCard({
  content,
  loading,
  loadingPhase,
  loadingQuestion,
  error,
  onContentChange,
  onKeyDown,
  onSubmit,
  onMoodSelect,
}: InputCardProps) {
  // 感情オーブの展開フラグ（UI ローカル状態のみ）
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const isEmpty = content.trim() === "";
  // 最小入力の入口を出す条件：onMoodSelect が渡され、入力欄が空のときだけ
  const canPickMood = !!onMoodSelect && isEmpty;

  const handlePick = (label: string) => {
    onMoodSelect?.(label);
    setShowMoodPicker(false);
  };

  return (
    <div className="input-card rounded-3xl p-[27px]"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-1)" }}>
      <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>今日の記録</p>

      {loading ? (
        /* ── ローディング演出 ── */
        <div className="h-40 flex flex-col items-center justify-center gap-5">
          {/* 波紋 */}
          <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
            <div className="loading-ring" style={{ animationDelay: "0s" }} />
            <div className="loading-ring" style={{ animationDelay: "0.87s" }} />
            <div className="loading-ring" style={{ animationDelay: "1.73s" }} />
            <div className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: "var(--green)", opacity: 0.7 }} />
          </div>

          {/* フェーズテキスト */}
          <p key={loadingPhase}
            className="text-xs tracking-widest nagi-phase"
            style={{ color: "var(--text-muted)" }}>
            {PHASE_LABELS[loadingPhase]}
          </p>
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={5000}
          placeholder={"今日、どんなことがありましたか。\nうまく言葉にならなくても、大丈夫です。"}
          className="w-full h-40 text-sm resize-none outline-none leading-relaxed"
          style={{
            color: "var(--text-primary)",
            backgroundColor: "transparent",
          }}
          aria-label="今日の記録"
        />
      )}

      {/* 感情オーブ（最小入力・段階的開示）。入力欄は圧迫せず、入口タップ時だけ展開 */}
      {!loading && canPickMood && showMoodPicker && (
        <div className="dialog-pop mt-5">
          <MoodOrbPicker onSelect={handlePick} />
        </div>
      )}

      {/* 問いかけ（ローディング中のみ） */}
      {loadingQuestion && (
        <p key={loadingQuestion}
          className="text-sm text-center leading-relaxed nagi-question"
          style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
          {loadingQuestion}
        </p>
      )}

      {error && <p className="text-xs mt-2" style={{ color: "#fca5a5" }}>{error}</p>}
      {!loading && (
        <div className="flex items-center justify-between mt-4">
          {canPickMood ? (
            <button
              onClick={() => setShowMoodPicker(v => !v)}
              aria-expanded={showMoodPicker}
              className="inline-flex items-center gap-2 text-xs rounded-full px-3.5 py-2 transition-colors"
              style={{
                color: "var(--text-muted)",
                backgroundColor: "var(--bg)",
                border: "1px solid var(--border)",
              }}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--green)" }} />
              {showMoodPicker ? "そっと閉じる" : "気持ちから選ぶ"}
            </button>
          ) : (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {content.length > 4800 ? `${content.length} / 5000` : ""}
            </span>
          )}
          <button
            onClick={onSubmit}
            onPointerDown={spawnRipple}
            disabled={!content.trim()}
            className="btn-primary px-7 py-2.5 rounded-full text-xs tracking-widest"
            style={{
              backgroundColor: !content.trim() ? "var(--bg-disabled)" : "var(--green)",
              color:           !content.trim() ? "var(--text-disabled)" : "var(--color-btn-text)",
              cursor:          !content.trim() ? "not-allowed" : "pointer",
            }}
          >
            記録する
          </button>
        </div>
      )}
    </div>
  );
}
