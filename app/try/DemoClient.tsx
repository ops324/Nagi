"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Entry, Emotion, EMOTION_COLORS } from "../types";
import EntryCard from "../components/EntryCard";
import { ABOUT_INTRO } from "../lib/about";

// ── HomeClient と共通の演出ロジック（お試し用に最小限を独立保持） ──
// HomeClient（約1190行・state密結合）への依存を避けるため、ここでは小さく再定義する。
const LOADING_QUESTIONS: Record<"negative" | "positive" | "neutral", string[]> = {
  negative: [
    "今、体のどこかに重さを感じますか",
    "その感情は、何を守ろうとしているのでしょう",
    "この気持ちに形があるとしたら、どんな形でしょう",
    "少し離れた場所から、今の自分を眺めてみてください",
  ],
  positive: [
    "この喜びは、あなたの何と共鳴していますか",
    "今の自分に、どんな言葉を贈りますか",
    "この感覚を、もう少しだけ味わってみてください",
    "何がそれを可能にしたのでしょう",
  ],
  neutral: [
    "今この瞬間、呼吸はどんな深さですか",
    "この出来事を少し遠くから眺めたら、どう見えるでしょう",
    "記録することで、何かが変わりましたか",
    "この記録の奥に、何が静かに在りますか",
  ],
};

const PHASE_LABELS = ["読んでいます", "感じています", "ことばを選んでいます"] as const;

const detectTone = (text: string): keyof typeof LOADING_QUESTIONS => {
  if (/疲|つら|辛|悲|苦|怒|不安|心配|嫌|落ち込|きつ|しんど|泣|痛|怖|絶望|無理/.test(text)) return "negative";
  if (/嬉|楽し|よかっ|良かっ|最高|うれし|幸|ありがた|充実|達成|できた|頑張|嬉しい/.test(text)) return "positive";
  return "neutral";
};

const emotionGradient = (emotions: Emotion[]) => {
  if (!emotions?.length) return "transparent";
  const total = emotions.reduce((s, e) => s + e.score, 0) || 1;
  let pos = 0;
  const stops: string[] = [];
  emotions.forEach((em) => {
    const color = EMOTION_COLORS[em.label] || "#d1fae5";
    const pct = (em.score / total) * 100;
    const mid = pos + pct / 2;
    stops.push(`${color} ${mid.toFixed(1)}%`);
    pos += pct;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
};

const DEMO_MAX_CHARS = 2000;

export default function DemoClient() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [loadingQuestion, setLoadingQuestion] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Entry | null>(null);
  const questionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ローディング中のフェーズサイクル（HomeClient と同じ間隔）
  useEffect(() => {
    if (!loading) { setLoadingPhase(0); return; }
    const t1 = setTimeout(() => setLoadingPhase(1), 1800);
    const t2 = setTimeout(() => setLoadingPhase(2), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  const handleSubmit = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    setError("");
    setLoadingQuestion(null);
    if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    const pool = LOADING_QUESTIONS[detectTone(content)];
    questionTimerRef.current = setTimeout(() => {
      setLoadingQuestion(pool[Math.floor(Math.random() * pool.length)]);
    }, 1600);

    try {
      const res = await fetch("/api/comment/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "エラーが発生しました"); return; }

      // お試しのため DB 保存・localStorage は一切しない（ページを離れたら消える）
      setResult({
        id: "demo",
        content,
        comment:      data.comment,
        emotions:     data.emotions || [],
        dominant:     data.dominant || "穏やか",
        energy:       data.energy   || 5,
        createdAt:    new Date().toISOString(),
        insightLevel: data.insightLevel || "moderate",
      });
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
      setLoadingQuestion(null);
      if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter で送信
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-6 py-12">
      {/* ロゴ */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extralight tracking-[0.3em]" style={{ color: "var(--text-secondary)" }}>凪</h1>
        <p className="text-xs tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>Nagi · 自己観察の記録</p>
      </div>

      {/* 導入 */}
      <p className="text-sm leading-relaxed text-center mb-3" style={{ color: "var(--text-secondary)" }}>
        {ABOUT_INTRO}
      </p>
      <p className="text-xs leading-relaxed text-center mb-8" style={{ color: "var(--text-muted)" }}>
        ここで書いたことばは保存されません。登録のまえに、一度だけ試してみてください。
      </p>

      {/* 入力カード（応答前のみ表示） */}
      {!result && (
        <div className="input-card rounded-3xl p-[27px] shadow-sm"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>今日の記録</p>

          {loading ? (
            /* ── ローディング演出 ── */
            <div className="h-40 flex flex-col items-center justify-center gap-5">
              <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                <div className="loading-ring" style={{ animationDelay: "0s" }} />
                <div className="loading-ring" style={{ animationDelay: "0.87s" }} />
                <div className="loading-ring" style={{ animationDelay: "1.73s" }} />
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: "var(--green)", opacity: 0.7 }} />
              </div>
              <p key={loadingPhase}
                className="text-xs tracking-widest nagi-phase"
                style={{ color: "var(--text-muted)" }}>
                {PHASE_LABELS[loadingPhase]}
              </p>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={DEMO_MAX_CHARS}
              placeholder={"今日、どんなことがありましたか。\nうまく言葉にならなくても、大丈夫です。"}
              className="w-full h-40 text-sm resize-none outline-none leading-relaxed"
              style={{ color: "var(--text-primary)", backgroundColor: "transparent" }}
              aria-label="今日の記録"
            />
          )}

          {loadingQuestion && (
            <p key={loadingQuestion}
              className="text-sm text-center leading-relaxed nagi-question"
              style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
              {loadingQuestion}
            </p>
          )}

          {error && <p className="text-xs mt-2" style={{ color: "var(--color-danger)" }}>{error}</p>}

          {!loading && (
            <div className="flex items-center justify-end mt-4">
              <button
                onClick={handleSubmit}
                disabled={!content.trim()}
                className="px-7 py-2.5 rounded-full text-xs tracking-widest transition-all"
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
      )}

      {/* 凪の応答（お試し・読み取り専用） */}
      {result && (
        <>
          <EntryCard
            entry={result}
            emotionGradient={emotionGradient}
            EMOTION_COLORS={EMOTION_COLORS}
            isNew
          />

          {/* 登録CTA */}
          <div className="mt-10 text-center">
            <div className="mx-auto mb-7 h-px w-16" style={{ backgroundColor: "var(--border)" }} />
            <p className="text-sm leading-relaxed mb-1" style={{ color: "var(--text-secondary)" }}>
              もうすこし、凪と過ごしてみたくなったら。
            </p>
            <p className="text-sm leading-relaxed mb-7" style={{ color: "var(--text-secondary)" }}>
              書いたことばは、登録すると残せます。
            </p>
            <Link
              href="/auth/signup"
              className="inline-block px-10 py-3 rounded-full text-xs tracking-widest transition-all"
              style={{ backgroundColor: "var(--green)", color: "var(--color-btn-text)" }}
            >
              はじめる
            </Link>
            <p className="text-xs mt-5" style={{ color: "var(--text-muted)" }}>
              すでにアカウントをお持ちの方は{" "}
              <Link href="/auth/login" className="underline" style={{ color: "var(--text-secondary)" }}>
                こちら
              </Link>
            </p>
            <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
              ※ いま書いたことばは保存されていません。
            </p>
          </div>
        </>
      )}

      {/* 応答前のフッター導線 */}
      {!result && (
        <p className="text-center text-xs mt-8" style={{ color: "var(--text-muted)" }}>
          すでにアカウントをお持ちの方は{" "}
          <Link href="/auth/login" className="underline" style={{ color: "var(--text-secondary)" }}>
            ログイン
          </Link>
        </p>
      )}
    </div>
  );
}
