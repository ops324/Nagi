"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Entry, Emotion, EMOTION_COLORS } from "./types";
import { createClient } from "@/lib/supabase/client";
import { logout } from "./auth/actions";
import EntryCard from "./components/EntryCard";

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

const EmotionCalendar = dynamic(() => import("./components/EmotionCalendar"), { ssr: false });

type Tab = "journal" | "calendar";

export default function Home() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("journal");
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newEntryId, setNewEntryId] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [loadingQuestion, setLoadingQuestion] = useState<string | null>(null);
  const questionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savedNoteIds, setSavedNoteIds] = useState<Set<string>>(new Set());
  const noteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [weeklySummary, setWeeklySummary] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const loadUser = async () => {
      const { data: claimsData, error } = await supabase.auth.getClaims();
      if (error || !claimsData?.claims) { router.replace("/auth/login"); return; }
      const claims = claimsData.claims;
      setUserEmail(claims.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", claims.sub)
        .single();
      if (profile?.is_admin) setIsAdmin(true);
    };

    const loadEntries = async () => {
      const { data: claimsData, error } = await supabase.auth.getClaims();
      if (error || !claimsData?.claims) { router.replace("/auth/login"); return; }

      const { data } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", claimsData.claims.sub)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        // Supabase は snake_case (created_at) で返すため camelCase (createdAt) にマップ
        setEntries(data.map(e => ({
          ...e,
          createdAt:    e.created_at,
          insightLevel: e.insight_level,
          note:         e.note ?? "",
          isFavorited:  e.is_favorited ?? false,
        })) as Entry[]);
        // 余韻メモを notes state に初期化
        const initialNotes: Record<string, string> = {};
        data.forEach(e => { initialNotes[e.id] = e.note ?? ""; });
        setNotes(initialNotes);
      } else {
        // 記録 0 件 → 初回ウェルカム画面を表示
        setShowWelcome(true);
      }
    };

    loadUser();
    loadEntries();
    const draft = localStorage.getItem("nagi-draft");
    if (draft) setContent(draft);
  }, []);

  // ローディング中のフェーズサイクル
  useEffect(() => {
    if (!loading) { setLoadingPhase(0); return; }
    const t1 = setTimeout(() => setLoadingPhase(1), 1800);
    const t2 = setTimeout(() => setLoadingPhase(2), 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loading]);

  // スワイプでタブ切替（journal ↔ calendar）
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    touchStartRef.current = null;
    // 横方向の動きが垂直の1.5倍以上 かつ 60px以上のときのみ発火
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && tab === "journal")  setTab("calendar");
    if (dx > 0 && tab === "calendar") setTab("journal");
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    setLoadingQuestion(null);
    if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    const tone = detectTone(content);
    const pool = LOADING_QUESTIONS[tone];
    questionTimerRef.current = setTimeout(() => {
      setLoadingQuestion(pool[Math.floor(Math.random() * pool.length)]);
    }, 1600);
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "エラーが発生しました"); return; }

      const supabase = createClient();
      const { data: claimsData, error: authErr } = await supabase.auth.getClaims();
      if (authErr || !claimsData?.claims) return;
      const userId = claimsData.claims.sub;

      const entry: Entry = {
        id: Date.now().toString(),
        content,
        comment:      data.comment,
        emotions:     data.emotions || [],
        dominant:     data.dominant || "穏やか",
        energy:       data.energy   || 5,
        createdAt:    new Date().toISOString(),
        insightLevel: data.insightLevel || "moderate",
      };

      await supabase.from("entries").insert({
        id:            entry.id,
        user_id:       userId,
        content:       entry.content,
        comment:       entry.comment,
        emotions:      entry.emotions,
        dominant:      entry.dominant,
        energy:        entry.energy,
        created_at:    entry.createdAt,    // camelCase → snake_case
        insight_level: entry.insightLevel, // camelCase → snake_case
      });
      setEntries([entry, ...entries]);
      setNewEntryId(entry.id);
      setTimeout(() => setNewEntryId(null), 4000);
      localStorage.removeItem("nagi-draft");
      setContent("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
      setLoadingQuestion(null);
      if (questionTimerRef.current) clearTimeout(questionTimerRef.current);
    }
  };

  const handleNoteChange = (id: string, value: string) => {
    setNotes(prev => ({ ...prev, [id]: value }));
    setSavedNoteIds(prev => { const next = new Set(prev); next.delete(id); return next; });

    const existing = noteTimersRef.current.get(id);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      const supabase = createClient();
      await supabase.from("entries").update({ note: value }).eq("id", id);
      setSavedNoteIds(prev => new Set(prev).add(id));
      setTimeout(() => setSavedNoteIds(prev => {
        const next = new Set(prev); next.delete(id); return next;
      }), 2000);
    }, 800);

    noteTimersRef.current.set(id, timer);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    if (value) localStorage.setItem("nagi-draft", value);
    else localStorage.removeItem("nagi-draft");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (content.trim() && !loading) handleSubmit();
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    const next = !entry.isFavorited;
    const supabase = createClient();
    await supabase.from("entries").update({ is_favorited: next }).eq("id", id);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, isFavorited: next } : e));
  };

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

  const handleWeeklySummary = async () => {
    if (weeklyLoading || weeklySummary) return;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekEntries = entries.filter(e => new Date(e.createdAt) >= weekStart);
    if (thisWeekEntries.length === 0) return;
    setWeeklyLoading(true);
    try {
      const res = await fetch("/api/weekly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: thisWeekEntries }),
      });
      const data = await res.json();
      if (res.ok) setWeeklySummary(data.summary);
    } catch {
      // silent
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (!error) {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    }
    setDeletingId(null);
  };

  const handleEditStart = (entry: Entry) => {
    setMenuOpenId(null);
    setDeletingId(null);
    setEditError("");
    setEditingText(entry.content);
    setEditingId(entry.id);
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditingText("");
    setEditError("");
  };

  const handleEditSave = async (id: string) => {
    const text = editingText.trim();
    if (!text) { setEditError("内容が空です"); return; }
    const original = entries.find((e) => e.id === id);
    if (!original) return;
    if (text === original.content.trim()) { handleEditCancel(); return; }

    setEditSaving(true);
    setEditError("");
    try {
      // 凪のコメント・感情を再生成
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "エラーが発生しました"); return; }

      const supabase = createClient();
      // created_at / note / is_favorited は対象に含めず保持
      const { error: updErr } = await supabase
        .from("entries")
        .update({
          content:       text,
          comment:       data.comment,
          emotions:      data.emotions || [],
          dominant:      data.dominant || "穏やか",
          energy:        data.energy   || 5,
          insight_level: data.insightLevel || "moderate", // camelCase → snake_case
        })
        .eq("id", id);
      if (updErr) { setEditError("保存に失敗しました"); return; }

      setEntries((prev) => prev.map((e) => e.id === id ? {
        ...e,
        content:      text,
        comment:      data.comment,
        emotions:     data.emotions || [],
        dominant:     data.dominant || "穏やか",
        energy:       data.energy   || 5,
        insightLevel: data.insightLevel || "moderate",
      } : e));

      setEditingId(null);
      setEditingText("");
    } catch {
      setEditError("通信エラーが発生しました");
    } finally {
      setEditSaving(false);
    }
  };


  // カレンダー／グラフから記録タブの該当エントリへナビゲート
  const navigateToEntry = (entry: Entry) => {
    setTab("journal");
    setHighlightedEntryId(entry.id);
  };

  // ハイライトされたエントリへスクロール（タブ切替後に実行）
  useEffect(() => {
    if (!highlightedEntryId) return;
    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`entry-${highlightedEntryId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const clearTimer = setTimeout(() => setHighlightedEntryId(null), 2800);
    return () => { clearTimeout(scrollTimer); clearTimeout(clearTimer); };
  }, [highlightedEntryId]);

  const handleShare = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      await navigator.share({ title: "凪", text: "静かな自己観察の記録アプリ「凪」", url });
    } else {
      await navigator.clipboard.writeText(url);
    }
  };

  // 記録メニュー（編集/削除）を外側クリック・Escapeで閉じる
  useEffect(() => {
    if (!menuOpenId) return;
    const handleClick = () => setMenuOpenId(null);
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpenId(null);
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpenId]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ja-JP", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: "journal",  label: "記録" },
    { key: "calendar", label: "カレンダー" },
  ];

  return (
    <div
      className="min-h-screen min-h-dvh"
      style={{ backgroundColor: "var(--bg)" }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >

      {/* ── Header ── */}
      <header className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--bg-header)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-lg mx-auto px-[27px] pt-5 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                <div className="icon-anim w-9 h-9">
                  <img src="/icon-nagi.png" alt="Nagi" className="w-9 h-9 block" />
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-extralight tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>凪</h1>
                <p className="text-xs tracking-widest mt-0.5" style={{ color: "var(--text-muted)" }}>Nagi · 自己観察の記録</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <a href="/admin"
                  className="flex items-center justify-center w-11 h-11 rounded-full transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  title="管理"
                  aria-label="管理者ダッシュボード">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ border: "1px solid var(--border)" }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="1" width="6" height="6" rx="1.5"/>
                      <rect x="9" y="1" width="6" height="6" rx="1.5"/>
                      <rect x="1" y="9" width="6" height="6" rx="1.5"/>
                      <rect x="9" y="9" width="6" height="6" rx="1.5"/>
                    </svg>
                  </span>
                </a>
              )}
              {userEmail && (
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center w-11 h-11 rounded-full transition-colors"
                  style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  title="シェア"
                  aria-label="アプリをシェア">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ border: "1px solid var(--border)" }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 10V2m0 0L5.5 4.5M8 2l2.5 2.5"/>
                      <path d="M4 7H2.5A1.5 1.5 0 001 8.5v5A1.5 1.5 0 002.5 15h11a1.5 1.5 0 001.5-1.5v-5A1.5 1.5 0 0013.5 7H12"/>
                    </svg>
                  </span>
                </button>
              )}
              {userEmail && (
                <a href="/account"
                  className="flex items-center justify-center w-11 h-11 rounded-full transition-colors"
                  style={{ color: "var(--text-muted)" }}
                  title="設定・ログアウト"
                  aria-label="アカウント設定">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ border: "1px solid var(--border)" }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="8" cy="5.5" r="2.5"/>
                      <path d="M2.5 14c0-2.76 2.46-5 5.5-5s5.5 2.24 5.5 5"/>
                    </svg>
                  </span>
                </a>
              )}
            </div>
          </div>

          {/* タブ */}
          <div className="flex gap-5 mt-4" role="tablist" aria-label="表示切替">
            {TAB_LABELS.map(({ key, label }) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                aria-controls={`panel-${key}`}
                id={`tab-${key}`}
                onClick={() => setTab(key)}
                className="pb-3 text-xs tracking-widest transition-colors"
                style={{
                  color: tab === key ? "var(--text-secondary)" : "var(--text-muted)",
                  borderBottom: tab === key ? "1.5px solid var(--tab-active)" : "1.5px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-[27px] py-8 space-y-5">

        {/* ══════════════════════════════
            記録タブ
        ══════════════════════════════ */}
        {tab === "journal" && (
          <div role="tabpanel" id="panel-journal" aria-labelledby="tab-journal" className="space-y-5">
            {/* 入力エリア */}
            <div className="rounded-3xl p-[27px] shadow-sm"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
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
                  onChange={(e) => handleContentChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={"今日、どんなことがありましたか。\nうまく言葉にならなくても、大丈夫です。"}
                  className="w-full h-40 text-sm resize-none outline-none leading-relaxed"
                  style={{
                    color: "var(--text-primary)",
                    backgroundColor: "transparent",
                  }}
                  aria-label="今日の記録"
                />
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
                <div className="flex justify-end mt-4">
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

            {/* あの日の凪（A-1） */}
            {(() => {
              const memory = getMemoryEntry();
              if (!memory) return null;
              return (
                <button
                  onClick={() => navigateToEntry(memory.entry)}
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
            })()}

            {/* 今週の凪（A-2） */}
            {(() => {
              const now = new Date();
              const weekStart = new Date(now);
              weekStart.setDate(now.getDate() - now.getDay());
              weekStart.setHours(0, 0, 0, 0);
              const thisWeekCount = entries.filter(e => new Date(e.createdAt) >= weekStart).length;
              if (thisWeekCount < 3 && !weeklySummary) return null;
              return (
                <div className="rounded-3xl p-[22px]"
                  style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>今週の凪</span>
                    <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-inner)" }} />
                  </div>
                  {weeklySummary ? (
                    <p className="text-sm leading-relaxed"
                      style={{
                        color: "var(--text-secondary)",
                        fontStyle: "italic",
                        borderLeft: "2px solid color-mix(in srgb, var(--green) 60%, transparent)",
                        paddingLeft: "12px",
                      }}>
                      {weeklySummary}
                    </p>
                  ) : (
                    <button
                      onClick={handleWeeklySummary}
                      disabled={weeklyLoading}
                      className="text-xs tracking-widest transition-opacity"
                      style={{ color: "var(--text-muted)", opacity: weeklyLoading ? 0.5 : 1 }}
                    >
                      {weeklyLoading ? "読んでいます…" : "今週のことばを聞く"}
                    </button>
                  )}
                </div>
              );
            })()}

            {/* 検索バー */}
            {entries.length > 0 && (
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: "var(--text-faint)" }}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="記録を検索…"
                  className="w-full pl-9 pr-4 py-2 rounded-2xl text-sm font-light outline-none transition-all"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                    style={{ color: "var(--text-faint)" }}
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* 感情フィルター（D-1） */}
            {entries.length > 0 && (() => {
              const availableEmotions = Array.from(
                new Set(entries.flatMap(e => e.emotions?.map(em => em.label) ?? []))
              );
              const hasFavorites = entries.some(e => e.isFavorited);
              if (availableEmotions.length === 0 && !hasFavorites) return null;
              return (
                <div className="overflow-x-auto pb-1 -mx-1 px-1">
                  <div className="flex gap-2 w-max">
                    <button
                      onClick={() => setFilterKey(null)}
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
                        onClick={() => setFilterKey(filterKey === label ? null : label)}
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
                        onClick={() => setFilterKey(filterKey === "✦" ? null : "✦")}
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
                  </div>
                </div>
              );
            })()}

            {/* 記録一覧 */}
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const filteredEntries = entries
                .filter(e =>
                  filterKey === null ? true
                  : filterKey === "✦" ? e.isFavorited
                  : e.emotions?.some(em => em.label === filterKey)
                )
                .filter(e =>
                  q === "" ? true
                  : (e.content?.toLowerCase().includes(q) ||
                     e.comment?.toLowerCase().includes(q) ||
                     e.note?.toLowerCase().includes(q))
                );
              return filteredEntries.length > 0 ? (
              <div className="space-y-4">
                {filteredEntries.map((entry) => {
                  // 編集モード: EntryCard の代わりにインライン編集UIを表示
                  if (editingId === entry.id) {
                    return (
                      <div
                        key={entry.id}
                        id={`entry-${entry.id}`}
                        className="rounded-3xl p-[27px] space-y-4"
                        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
                      >
                        {editSaving ? (
                          <div className="h-32 flex flex-col items-center justify-center gap-4">
                            <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
                              <div className="loading-ring" style={{ animationDelay: "0s" }} />
                              <div className="loading-ring" style={{ animationDelay: "0.87s" }} />
                              <div className="loading-ring" style={{ animationDelay: "1.73s" }} />
                              <div className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: "var(--green)", opacity: 0.7 }} />
                            </div>
                            <p className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>
                              凪が読みなおしています
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              maxLength={5000}
                              autoFocus
                              rows={6}
                              className="w-full text-sm resize-none outline-none leading-relaxed rounded-2xl p-3"
                              style={{
                                color: "var(--text-primary)",
                                backgroundColor: "var(--bg)",
                                border: "1px solid var(--border)",
                              }}
                              aria-label="記録を編集"
                            />
                            {editError && <p className="text-xs" style={{ color: "#fca5a5" }}>{editError}</p>}
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={handleEditCancel}
                                className="text-xs tracking-widest px-4 py-2 rounded-full"
                                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                              >
                                やめる
                              </button>
                              {(() => {
                                const disabled = !editingText.trim()
                                  || editingText.trim() === entry.content.trim();
                                return (
                                  <button
                                    onClick={() => handleEditSave(entry.id)}
                                    disabled={disabled}
                                    className="text-xs tracking-widest px-5 py-2 rounded-full transition-all"
                                    style={{
                                      backgroundColor: disabled ? "var(--bg-disabled)" : "var(--green)",
                                      color:           disabled ? "var(--text-disabled)" : "var(--color-btn-text)",
                                      cursor:          disabled ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    保存する
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // 通常モード: EntryCard コンポーネント
                  return (
                    <EntryCard
                      key={entry.id}
                      domId={`entry-${entry.id}`}
                      entry={{ ...entry, note: notes[entry.id] ?? entry.note ?? "" }}
                      emotionGradient={emotionGradient}
                      EMOTION_COLORS={EMOTION_COLORS}
                      onToggleFavorite={handleToggleFavorite}
                      onNoteChange={handleNoteChange}
                      noteSaved={savedNoteIds.has(entry.id)}
                      highlighted={highlightedEntryId === entry.id}
                      isNew={newEntryId === entry.id}
                      menuSlot={
                        deletingId === entry.id ? (
                          <div className="flex items-center gap-2" role="group" aria-live="polite" aria-label="削除確認">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-xs tracking-widest px-4 py-2 rounded-full transition-colors"
                              style={{ backgroundColor: "#fca5a530", color: "#ef4444", border: "1px solid #fca5a5" }}
                            >
                              削除する
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-xs tracking-widest px-4 py-2 rounded-full"
                              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                            >
                              やめる
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(menuOpenId === entry.id ? null : entry.id);
                              }}
                              className="flex items-center justify-center w-11 h-11 -mr-2 rounded-full transition-colors hover:bg-black/5"
                              style={{ color: "var(--text-muted)" }}
                              aria-label="この記録のメニュー"
                              aria-haspopup="menu"
                              aria-expanded={menuOpenId === entry.id}
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <circle cx="3" cy="8" r="1.5" />
                                <circle cx="8" cy="8" r="1.5" />
                                <circle cx="13" cy="8" r="1.5" />
                              </svg>
                            </button>
                            {menuOpenId === entry.id && (
                              <div
                                role="menu"
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-12 z-20 rounded-2xl overflow-hidden shadow-md"
                                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", minWidth: "120px" }}
                              >
                                <button
                                  role="menuitem"
                                  onClick={() => handleEditStart(entry)}
                                  className="w-full min-h-[44px] px-5 text-xs tracking-widest text-left transition-colors hover:bg-black/5"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  編集する
                                </button>
                                <div className="h-px" style={{ backgroundColor: "var(--border)" }} />
                                <button
                                  role="menuitem"
                                  onClick={() => { setMenuOpenId(null); setDeletingId(entry.id); }}
                                  className="w-full min-h-[44px] px-5 text-xs tracking-widest text-left transition-colors hover:bg-black/5"
                                  style={{ color: "#ef4444" }}
                                >
                                  削除する
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      }
                    />
                  );
                })}
              </div>
            ) : (
              !loading && (
                filterKey !== null || searchQuery ? (
                  <div className="text-center py-12">
                    <p className="text-sm" style={{ color: "var(--text-subtle)" }}>該当する記録はありません</p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm" style={{ color: "var(--text-subtle)" }}>まだ記録がありません</p>
                  </div>
                )
              )
            );
            })()}
          </div>
        )}

        {/* ══════════════════════════════
            カレンダータブ
        ══════════════════════════════ */}
        {tab === "calendar" && (
          <div role="tabpanel" id="panel-calendar" aria-labelledby="tab-calendar">
            <EmotionCalendar
              entries={entries}
              onNavigateToEntry={navigateToEntry}
            />

            {entries.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--text-subtle)" }}>記録するとカレンダーに表示されます</p>
              </div>
            )}

          </div>
        )}


      </main>

      {/* ══════════════════════════════
          初回ウェルカム画面（記録 0 件時）
      ══════════════════════════════ */}
      {showWelcome && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-title"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 welcome-fade-in"
          style={{ backgroundColor: "var(--bg)" }}
        >
          <div className="w-14 h-14 mb-6 rounded-2xl overflow-hidden">
            <img src="/icon-nagi.png" alt="Nagi" className="w-14 h-14 block" />
          </div>
          <p id="welcome-title" className="text-sm tracking-widest mb-5"
            style={{ color: "var(--text-subtle)" }}>凪へ ようこそ</p>

          <p className="text-xs leading-loose max-w-[300px] text-center"
            style={{ color: "var(--text-faint)" }}>
            凪は、出来事の良し悪しを決めません。あなたが書いたことばを静かに受けとり、そこにある気持ちをそっと言葉にして返します。
          </p>

          <div className="mt-6 mx-auto max-w-[300px] pt-5"
            style={{ borderTop: "1px solid var(--border-inner)" }}>
            <p className="text-xs tracking-widest mb-2 text-center"
              style={{ color: "var(--text-muted)" }}>最初の一歩</p>
            <p className="text-xs leading-loose text-center"
              style={{ color: "var(--text-faint)" }}>
              画面上部の入力欄に、今日のことを少しだけ書いてみてください。うまく言葉にならなくても、そのままで大丈夫です。記録すると、凪からことばが届きます。
            </p>
          </div>

          <button
            onClick={() => setShowWelcome(false)}
            className="mt-10 text-xs tracking-widest px-8 py-3 rounded-full"
            style={{ backgroundColor: "var(--green)", color: "var(--text-primary)" }}
          >
            はじめる
          </button>
        </div>
      )}
    </div>
  );
}
