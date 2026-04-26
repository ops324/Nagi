"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Entry, Emotion, EMOTION_COLORS } from "./types";
import { createClient } from "@/lib/supabase/client";
import { logout } from "./auth/actions";

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
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
        })) as Entry[]);
      }
    };

    loadUser();
    loadEntries();
  }, []);

  // 時刻に基づくライト/ダークモード切替（6〜18時: ライト、18〜6時: ダーク）
  useEffect(() => {
    const applyTheme = () => {
      const h = new Date().getHours();
      if (h >= 18 || h < 6) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    };
    applyTheme();
    const timer = setInterval(applyTheme, 60_000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
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
      setContent("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
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

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>

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
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  title="管理">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="1" width="6" height="6" rx="1.5"/>
                    <rect x="9" y="1" width="6" height="6" rx="1.5"/>
                    <rect x="1" y="9" width="6" height="6" rx="1.5"/>
                    <rect x="9" y="9" width="6" height="6" rx="1.5"/>
                  </svg>
                </a>
              )}
              {userEmail && (
                <a href="/account"
                  className="flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                  style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}
                  title="設定・ログアウト">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="8" cy="5.5" r="2.5"/>
                    <path d="M2.5 14c0-2.76 2.46-5 5.5-5s5.5 2.24 5.5 5"/>
                  </svg>
                </a>
              )}
            </div>
          </div>

          {/* タブ */}
          <div className="flex gap-5 mt-4">
            {TAB_LABELS.map(({ key, label }) => (
              <button
                key={key}
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
          <>
            {/* 入力エリア */}
            <div className="rounded-3xl p-[27px] shadow-sm"
              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>今日の記録</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={"今日、どんなことがありましたか。\nうまく言葉にならなくても、大丈夫です。"}
                className="w-full h-40 text-sm resize-none outline-none leading-relaxed"
                style={{
                  color: "var(--text-primary)",
                  backgroundColor: "transparent",
                }}
              />
              {error && <p className="text-xs mt-2" style={{ color: "#fca5a5" }}>{error}</p>}
              <div className="flex justify-end mt-4">
                <button
                  onClick={handleSubmit}
                  disabled={loading || !content.trim()}
                  className="px-7 py-2.5 rounded-full text-xs tracking-widest transition-all"
                  style={{
                    backgroundColor: loading || !content.trim() ? "var(--bg-disabled)" : "#6ee7b7",
                    color:           loading || !content.trim() ? "var(--text-disabled)" : "#065f46",
                    cursor:          loading || !content.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "受け取り中…" : "記録する"}
                </button>
              </div>
            </div>

            {/* 記録一覧 */}
            {entries.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs tracking-widest px-1" style={{ color: "var(--text-muted)" }}>過去の記録</p>
                {entries.map((entry) => (
                  <article
                    key={entry.id}
                    id={`entry-${entry.id}`}
                    className="rounded-3xl overflow-hidden shadow-sm flex"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: `1px solid ${highlightedEntryId === entry.id ? "var(--tab-active)" : "var(--border)"}`,
                      boxShadow: highlightedEntryId === entry.id ? "0 0 0 3px color-mix(in srgb, var(--tab-active) 20%, transparent)" : "none",
                      transition: "border-color 0.4s ease, box-shadow 0.4s ease",
                    }}>

                    {/* 左縦線アクセント */}
                    <div className="flex-shrink-0 w-[3px] self-stretch rounded-l-3xl"
                      style={{ background: "linear-gradient(to bottom, transparent, var(--border-inner) 30%, var(--border-inner) 70%, transparent)" }} />

                    {/* メインコンテンツ */}
                    <div className="flex-1 min-w-0 space-y-4 p-[27px]">

                      {/* 日時 + メニュー */}
                      <div className="flex items-center justify-between">
                        <time className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(entry.createdAt)}</time>
                        {deletingId === entry.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="text-xs tracking-widest px-3 py-1 rounded-full transition-colors"
                              style={{ backgroundColor: "#fca5a530", color: "#ef4444", border: "1px solid #fca5a5" }}
                            >
                              削除する
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="text-xs tracking-widest px-3 py-1 rounded-full"
                              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                            >
                              やめる
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeletingId(entry.id)}
                            className="flex items-center justify-center w-7 h-7 rounded-full transition-colors hover:bg-black/5"
                            style={{ color: "var(--text-muted)" }}
                            aria-label="メニュー"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <circle cx="3" cy="8" r="1.5" />
                              <circle cx="8" cy="8" r="1.5" />
                              <circle cx="13" cy="8" r="1.5" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* 感情グラデーション */}
                      {entry.emotions?.length > 0 && (
                        <div className="h-px rounded-full w-full"
                          style={{ background: emotionGradient(entry.emotions) }} />
                      )}

                      {/* 感情チップ */}
                      {entry.emotions?.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {entry.emotions.map((em) => (
                            <span key={em.label}
                              className="text-xs px-3 py-1 rounded-full flex items-center gap-1.5"
                              style={{
                                backgroundColor: (EMOTION_COLORS[em.label] || "#6ee7b7") + "22",
                                color: "var(--text-secondary)",
                                border: "1px solid " + (EMOTION_COLORS[em.label] || "#6ee7b7") + "44",
                              }}>
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: EMOTION_COLORS[em.label] || "#6ee7b7" }} />
                              {em.label}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 本文 */}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-entry)" }}>
                        {entry.content}
                      </p>

                      {/* FROM NAGI — 折りたたみ */}
                      <div>
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="w-full flex items-center gap-2"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <span className="text-xs tracking-widest flex-shrink-0">FROM NAGI</span>
                          <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-inner)" }} />
                          <span className="text-xs tracking-widest flex-shrink-0">
                            {expandedIds.has(entry.id) ? "とじる" : "ひらく"}
                          </span>
                        </button>
                        {expandedIds.has(entry.id) && (
                          <p className="text-sm leading-relaxed mt-3"
                            style={{
                              color: "var(--text-secondary)",
                              fontStyle: "italic",
                              borderLeft: entry.insightLevel === "deep" ? "2px solid var(--tab-active)" : undefined,
                              paddingLeft: entry.insightLevel === "deep" ? "12px" : undefined,
                            }}>
                            {entry.comment}
                          </p>
                        )}
                      </div>

                    </div>
                  </article>
                ))}
              </div>
            ) : (
              !loading && (
                <div className="text-center py-20">
                  <p className="text-sm" style={{ color: "var(--text-subtle)" }}>まだ記録がありません</p>
                  <p className="text-xs mt-2" style={{ color: "var(--text-faint)" }}>今日の気持ちを書いてみてください</p>
                </div>
              )
            )}
          </>
        )}

        {/* ══════════════════════════════
            カレンダータブ
        ══════════════════════════════ */}
        {tab === "calendar" && (
          <>
            <EmotionCalendar
              entries={entries}
              onNavigateToEntry={navigateToEntry}
            />

            {entries.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm" style={{ color: "var(--text-subtle)" }}>記録するとカレンダーに表示されます</p>
              </div>
            )}

          </>
        )}


      </main>
    </div>
  );
}
