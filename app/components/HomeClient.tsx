"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { Entry, Emotion, EMOTION_COLORS } from "../types";
import { createClient } from "@/lib/supabase/client";
import { logout } from "../auth/actions";
import EntryCard from "./EntryCard";
import Toast from "./ui/Toast";
import TabBar from "./ui/TabBar";
import { ABOUT_INTRO, ABOUT_FIRST_STEP } from "../lib/about";
import { spawnRipple } from "../lib/ripple";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as RadixDialog from "@radix-ui/react-dialog";

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

// 今週の凪キャッシュ用：その週の日曜始まりを YYYY-MM-DD で返す
const weekStartKey = () => {
  const now = new Date();
  const ws = new Date(now);
  ws.setDate(now.getDate() - now.getDay());
  ws.setHours(0, 0, 0, 0);
  return ws.toISOString().slice(0, 10);
};

const EmotionCalendar = dynamic(() => import("./EmotionCalendar"), { ssr: false });

type Tab = "journal" | "calendar";

type HomeClientProps = {
  initialEntries: Entry[];
  userEmail: string | null;
  isAdmin: boolean;
};

export default function HomeClient({ initialEntries, userEmail, isAdmin }: HomeClientProps) {
  // Supabase ブラウザクライアント（@supabase/ssr は内部でシングルトン）を共有
  const supabase = useMemo(() => createClient(), []);
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("journal");
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ entry: Entry; index: number } | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const errorToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [regenerateOnEdit, setRegenerateOnEdit] = useState(true);
  const [newEntryId, setNewEntryId] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [loadingQuestion, setLoadingQuestion] = useState<string | null>(null);
  const questionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    initialEntries.forEach(e => { init[e.id] = e.note ?? ""; });
    return init;
  });
  const [savedNoteIds, setSavedNoteIds] = useState<Set<string>>(new Set());
  const noteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [weeklySummary, setWeeklySummary] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(initialEntries.length === 0);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // 記録・ユーザー情報はサーバー（app/page.tsx）から props で受け取る。
  // ここではブラウザ専用の下書き・今週の凪キャッシュのみ復元する。
  useEffect(() => {
    const draft = localStorage.getItem("nagi-draft");
    if (draft) setContent(draft);
    const cachedWeekly = localStorage.getItem(`nagi-weekly-${weekStartKey()}`);
    if (cachedWeekly) setWeeklySummary(cachedWeekly);
  }, []);

  // ウェルカムを閉じた直後、モバイルのアプリ内ブラウザで残るスクロールずれを最上部に戻す
  // （Radix Dialog の自動フォーカス／scroll-lock 起因で本文上部が sticky ヘッダーに隠れるのを防ぐ）
  useEffect(() => {
    if (!showWelcome) window.scrollTo(0, 0);
  }, [showWelcome]);

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

  const showErrorToast = (msg: string) => {
    setErrorToast(msg);
    if (errorToastTimerRef.current) clearTimeout(errorToastTimerRef.current);
    errorToastTimerRef.current = setTimeout(() => setErrorToast(null), 4000);
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

      const { error: insertErr } = await supabase.from("entries").insert({
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
      if (insertErr) {
        // 保存失敗：UI に追加せず下書きも残し、ユーザーに再試行を促す
        showErrorToast("記録の保存に失敗しました。もう一度お試しください");
        return;
      }
      setEntries([entry, ...entries]);
      setNewEntryId(entry.id);
      setTimeout(() => setNewEntryId(null), 4000);
      // 投稿後、凪の返答（新しい記録）まで自動スクロール
      setTimeout(() => {
        document
          .getElementById(`entry-${entry.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 120);
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
      const { error } = await supabase.from("entries").update({ note: value }).eq("id", id);
      if (error) {
        showErrorToast("メモの保存に失敗しました");
        return;
      }
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
    // 楽観更新 → 失敗時はロールバック
    setEntries(prev => prev.map(e => e.id === id ? { ...e, isFavorited: next } : e));
    const { error } = await supabase.from("entries").update({ is_favorited: next }).eq("id", id);
    if (error) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, isFavorited: !next } : e));
      showErrorToast("お気に入りの更新に失敗しました");
    }
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
      if (res.ok) {
        setWeeklySummary(data.summary);
        localStorage.setItem(`nagi-weekly-${weekStartKey()}`, data.summary);
      }
    } catch {
      // silent
    } finally {
      setWeeklyLoading(false);
    }
  };

  const commitDelete = async (entry: Entry, index: number) => {
    const { error } = await supabase.from("entries").delete().eq("id", entry.id);
    if (error) {
      // 削除失敗：UI から消えた記録を元の位置へ復元
      setEntries(prev => {
        if (prev.some(e => e.id === entry.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(index, next.length), 0, entry);
        return next;
      });
      showErrorToast("記録の削除に失敗しました");
    }
  };

  // 楽観的削除：UIから即座に外し、トーストで5秒間アンドゥ可能にする
  const handleDelete = (id: string) => {
    setDeletingId(null);
    // 保留中の削除があれば即コミット（保留は常に1件）
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    if (pendingDelete) commitDelete(pendingDelete.entry, pendingDelete.index);

    const index = entries.findIndex((e) => e.id === id);
    const entry = entries[index];
    if (!entry) return;

    setEntries((prev) => prev.filter((e) => e.id !== id));
    setPendingDelete({ entry, index });
    deleteTimerRef.current = setTimeout(() => {
      commitDelete(entry, index);
      setPendingDelete(null);
      deleteTimerRef.current = null;
    }, 5000);
  };

  const handleUndoDelete = () => {
    if (!pendingDelete) return;
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    const { entry, index } = pendingDelete;
    setEntries((prev) => {
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, entry);
      return next;
    });
    setPendingDelete(null);
  };

  const handleEditStart = (entry: Entry) => {
    setDeletingId(null);
    setEditError("");
    setRegenerateOnEdit(true);
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
      // 凪に読みなおしてもらわない場合：本文のみ更新し、ことば・感情は保持
      if (!regenerateOnEdit) {
        const { error: updErr } = await supabase
          .from("entries")
          .update({ content: text })
          .eq("id", id);
        if (updErr) { setEditError("保存に失敗しました"); return; }
        setEntries((prev) => prev.map((e) => e.id === id ? { ...e, content: text } : e));
        setEditingId(null);
        setEditingText("");
        return;
      }

      // 凪のコメント・感情を再生成
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || "エラーが発生しました"); return; }

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
                  className="btn-ghost flex items-center justify-center w-11 h-11 rounded-full transition-colors"
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
                  className="btn-ghost flex items-center justify-center w-11 h-11 rounded-full transition-colors"
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
                <button
                  onClick={() => setShowAccountMenu(true)}
                  className="btn-ghost flex items-center justify-center w-11 h-11 rounded-full transition-colors"
                  style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  title="アカウントメニュー"
                  aria-label="アカウントメニュー">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full"
                    style={{ border: "1px solid var(--border)" }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="8" cy="5.5" r="2.5"/>
                      <path d="M2.5 14c0-2.76 2.46-5 5.5-5s5.5 2.24 5.5 5"/>
                    </svg>
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* タブ */}
          <TabBar
            tabs={TAB_LABELS}
            active={tab}
            onChange={(key) => setTab(key as Tab)}
            ariaLabel="表示切替"
            withPanels
            className="mt-4"
          />
        </div>
      </header>

      <main className="max-w-lg mx-auto px-[27px] py-8 space-y-5">

        {/* ══════════════════════════════
            記録タブ
        ══════════════════════════════ */}
        {tab === "journal" && (
          <div role="tabpanel" id="panel-journal" aria-labelledby="tab-journal" className="space-y-5">
            {/* 入力エリア */}
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
                  onChange={(e) => handleContentChange(e.target.value)}
                  onKeyDown={handleKeyDown}
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
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {content.length > 4800 ? `${content.length} / 5000` : ""}
                  </span>
                  <button
                    onClick={handleSubmit}
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
            )}

            {/* 感情フィルター（D-1） */}
            {entries.length > 0 && (() => {
              const availableEmotions = Array.from(
                new Set(entries.flatMap(e => e.emotions?.map(em => em.label) ?? []))
              );
              const hasFavorites = entries.some(e => e.isFavorited);
              const hasDeep = entries.some(e => e.insightLevel === "deep");
              if (availableEmotions.length === 0 && !hasFavorites && !hasDeep) return null;
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
                    {hasDeep && (
                      <button
                        onClick={() => setFilterKey(filterKey === "deep" ? null : "deep")}
                        className="text-xs px-3 py-1.5 rounded-full transition-all flex-shrink-0"
                        style={{
                          border: `1px solid ${filterKey === "deep" ? "var(--tab-active)" : "var(--border)"}`,
                          color: filterKey === "deep" ? "var(--tab-active)" : "var(--text-muted)",
                          backgroundColor: filterKey === "deep" ? "color-mix(in srgb, var(--tab-active) 10%, transparent)" : "transparent",
                        }}
                      >
                        深い気づき
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
                  : filterKey === "deep" ? e.insightLevel === "deep"
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
                {filteredEntries.map((entry, entryIndex) => {
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
                            <div className="flex flex-col gap-1.5">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={regenerateOnEdit}
                                onClick={() => setRegenerateOnEdit((v) => !v)}
                                className="flex items-center gap-2.5 text-xs"
                                style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}
                              >
                                <span
                                  aria-hidden="true"
                                  style={{
                                    width: "34px",
                                    height: "20px",
                                    borderRadius: "9999px",
                                    padding: "2px",
                                    backgroundColor: regenerateOnEdit ? "var(--green)" : "var(--bg-disabled)",
                                    display: "flex",
                                    justifyContent: regenerateOnEdit ? "flex-end" : "flex-start",
                                    transition: "background-color 0.2s ease",
                                    flexShrink: 0,
                                  }}
                                >
                                  <span style={{ width: "16px", height: "16px", borderRadius: "50%", backgroundColor: "#fff" }} />
                                </span>
                                凪に読みなおしてもらう
                              </button>
                              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {regenerateOnEdit
                                  ? "凪のことばは、読みなおすと新しくなります"
                                  : "凪のことばは、そのまま残ります"}
                              </p>
                            </div>
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
                                    onPointerDown={spawnRipple}
                                    disabled={disabled}
                                    className="btn-primary text-xs tracking-widest px-5 py-2 rounded-full"
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
                      index={entryIndex}
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
                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button
                                className="btn-ghost flex items-center justify-center w-11 h-11 -mr-2 rounded-full"
                                style={{ color: "var(--text-muted)" }}
                                aria-label="この記録のメニュー"
                              >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                  <circle cx="3" cy="8" r="1.5" />
                                  <circle cx="8" cy="8" r="1.5" />
                                  <circle cx="13" cy="8" r="1.5" />
                                </svg>
                              </button>
                            </DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content
                                align="end"
                                sideOffset={4}
                                className="z-30 rounded-2xl overflow-hidden"
                                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", minWidth: "120px", boxShadow: "var(--shadow-3)" }}
                              >
                                <DropdownMenu.Item
                                  onSelect={() => handleEditStart(entry)}
                                  className="min-h-[44px] px-5 flex items-center text-xs tracking-widest cursor-pointer outline-none transition-colors hover:bg-[var(--state-hover)] data-[highlighted]:bg-[var(--state-hover)]"
                                  style={{ color: "var(--text-secondary)" }}
                                >
                                  編集する
                                </DropdownMenu.Item>
                                <DropdownMenu.Separator className="h-px" style={{ backgroundColor: "var(--border)" }} />
                                <DropdownMenu.Item
                                  onSelect={() => setDeletingId(entry.id)}
                                  className="min-h-[44px] px-5 flex items-center text-xs tracking-widest cursor-pointer outline-none transition-colors hover:bg-[var(--state-hover)] data-[highlighted]:bg-[var(--state-hover)]"
                                  style={{ color: "#ef4444" }}
                                >
                                  削除する
                                </DropdownMenu.Item>
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>
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
          アカウントメニュー（ボトムシート）
      ══════════════════════════════ */}
      {showAccountMenu && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="アカウントメニュー"
          className="fixed inset-0 z-50 account-sheet-overlay"
          onClick={() => setShowAccountMenu(false)}
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
              onClick={() => setShowAccountMenu(false)}
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
      )}

      {/* ══════════════════════════════
          初回ウェルカム画面（記録 0 件時）
      ══════════════════════════════ */}
      <RadixDialog.Root open={showWelcome} onOpenChange={setShowWelcome}>
        <RadixDialog.Portal>
          <RadixDialog.Content
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 welcome-fade-in focus:outline-none"
            style={{ backgroundColor: "var(--bg)" }}
          >
            <div className="w-14 h-14 mb-6 rounded-2xl overflow-hidden">
              <img src="/icon-nagi.png" alt="Nagi" className="w-14 h-14 block" />
            </div>
            <RadixDialog.Title className="text-sm tracking-widest mb-5"
              style={{ color: "var(--text-muted)" }}>凪へ ようこそ</RadixDialog.Title>

            <p className="text-xs leading-loose max-w-[300px] text-center"
              style={{ color: "var(--text-secondary)" }}>
              {ABOUT_INTRO}
            </p>

            <div className="mt-6 mx-auto max-w-[300px] pt-5"
              style={{ borderTop: "1px solid var(--border-inner)" }}>
              <p className="text-xs tracking-widest mb-2 text-center"
                style={{ color: "var(--text-muted)" }}>最初の一歩</p>
              <p className="text-xs leading-loose text-center"
                style={{ color: "var(--text-secondary)" }}>
                {ABOUT_FIRST_STEP}
              </p>
            </div>

            <RadixDialog.Close asChild>
              <button
                onPointerDown={spawnRipple}
                className="btn-primary mt-10 text-xs tracking-widest px-8 py-3 rounded-full"
                style={{ backgroundColor: "var(--green)", color: "var(--color-btn-text)" }}
              >
                はじめる
              </button>
            </RadixDialog.Close>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      {/* 削除アンドゥ トースト */}
      {pendingDelete && (
        <Toast
          message="記録を削除しました"
          actionLabel="元に戻す"
          onAction={handleUndoDelete}
        />
      )}

      {/* エラートースト（保存・更新・削除の失敗時） */}
      {errorToast && !pendingDelete && (
        <Toast message={errorToast} />
      )}
    </div>
  );
}
