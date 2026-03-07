"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Entry, Emotion, EMOTION_COLORS } from "./types";
import { createClient } from "@/lib/supabase/client";
import { logout } from "./auth/actions";

// 今日から n 日前の日付文字列を返す（JST）
function seedDate(daysAgo: number, time: string): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${time}+09:00`;
}

const SEED_ENTRIES: Entry[] = [
  {
    id: "u-seed-9",
    content: "朝起きたとき、今日が楽しみだと思った。特別なことがあるわけでもないのに。感情に振り回されていた自分が、少しずつ「こういう感情もあるんだな」と眺められるようになってきた。主役として感じながら、同時に観客として眺めている自分がいる。その両方があることが、豊かさなのかもしれない。",
    comment: "演じながら眺めている——その両方を同時に持てるようになった日。「豊かさ」という言葉が自然に出てきたのは、何かが静かに積み重なってきたからかもしれない。これからの物語の中で、あなたはどんな一場面を大切にしたいですか。",
    emotions: [{ label: "感謝", score: 0.8 }, { label: "充実", score: 0.6 }, { label: "喜び", score: 0.4 }],
    dominant: "感謝",
    energy: 9,
    createdAt: seedDate(0, "08:30:00"),
  },
  {
    id: "u-seed-8",
    content: "散歩しながら、ふと思った。「自分はこういう人間だ」とずっと信じていたことが、本当にそうなのだろうか。もしかしたら、ずっと同じフィルターを通して世界を見ていただけで、そのフィルターを外すと全然違う景色が見えるかもしれない。怖いけど、それより可能性の方が大きく感じた。",
    comment: "「フィルターを外すと違う景色が見えるかもしれない」——そう感じた瞬間、怖さより可能性の方が大きかった。長い間かけていたと感じるフィルターの中で、最も外してみたいものは何ですか。",
    emotions: [{ label: "希望", score: 0.7 }, { label: "充実", score: 0.5 }, { label: "感謝", score: 0.3 }],
    dominant: "希望",
    energy: 8,
    createdAt: seedDate(1, "16:00:00"),
  },
  {
    id: "u-seed-7",
    content: "変わろうとすることは、思った以上にエネルギーがいる。疲れた日は古い考え方に引っ張られる。意志を持って動こうとしているのに、身体が追いついてこない感じがある。それでも少し前の自分と今の自分を比べると、確かに何かが違う。結果よりも、変わろうとしている自分を見ていたい。",
    comment: "変化の途中にある疲れの中で、「変わろうとしている自分を見ていたい」と書けた。その言葉はスクリーンの出来事を評価するのではなく、物語そのものを見守る目線かもしれない。今「確かに違う」と感じる部分は、どこですか。",
    emotions: [{ label: "疲れ", score: 0.5 }, { label: "希望", score: 0.4 }, { label: "穏やか", score: 0.3 }],
    dominant: "疲れ",
    energy: 6,
    createdAt: seedDate(2, "21:30:00"),
  },
  {
    id: "u-seed-6",
    content: "今日、仕事で大きな選択をした。「安全な道」と「自分がやりたい道」。以前なら迷わず安全な方を選んでいた。でも今日は「これは自分の意志か、それとも恐れからか」を一度確認してから、やりたい道を選んだ。不安はあったけど、選んだ後の清々しさは本物だった。",
    comment: "「恐れからか、意志からか」を確認してから選んだ——その一歩は、自分が自分の人生の選択者であることを実感した瞬間かもしれない。選んだ後の「清々しさ」は、どんな感覚として身体にありましたか。",
    emotions: [{ label: "充実", score: 0.6 }, { label: "希望", score: 0.5 }, { label: "安心", score: 0.3 }],
    dominant: "充実",
    energy: 7,
    createdAt: seedDate(3, "19:00:00"),
  },
  {
    id: "u-seed-5",
    content: "久しぶりに昔の友人と会った。その場の空気に引っ張られて、自分の意見をうまく言えなかった。昔のパターンに戻ってしまった感じがして、帰り道に落ち込んだ。でもふと気がついた——「また演じてしまった」とわかっている自分がいること自体、少し前の自分とは違う。",
    comment: "「また演じてしまった」と気づいた自分がいた——以前は演じていることにさえ気づかなかったかもしれない。その観察する目は、いつ頃から生まれてきたと感じますか。",
    emotions: [{ label: "穏やか", score: 0.5 }, { label: "不安", score: 0.3 }, { label: "安心", score: 0.3 }],
    dominant: "穏やか",
    energy: 5,
    createdAt: seedDate(4, "20:00:00"),
  },
  {
    id: "u-seed-4",
    content: "友人に「本当はどうしたいの？」と聞かれて、すぐに答えられなかった。話しながら気づいたことがある。ずっと「こうすべき」「こう見られたい」という基準で動いていた。それは誰かから刷り込まれた判断基準で、自分のものではなかったかもしれない。怖いけど、気づけてよかったと思う。",
    comment: "「誰の判断基準で動いていたか」に気づいた——そこには怖さも伴う。その気づきを「よかった」と受け取れているのは、どんな部分からでしょうか。自分の基準を持つとしたら、まず何を大切にしたいですか。",
    emotions: [{ label: "希望", score: 0.6 }, { label: "穏やか", score: 0.4 }, { label: "不安", score: 0.3 }],
    dominant: "希望",
    energy: 6,
    createdAt: seedDate(5, "15:30:00"),
  },
  {
    id: "u-seed-3",
    content: "自分の価値観とは何だろうとずっと考えている。仕事でも人間関係でも判断を迫られるたびに何かに迷う。それが親から受け継いだ考え方なのか、社会の空気を読んでいるだけなのか、本当に自分が大切にしていることなのか。ぐるぐるしてきた。でも問い続けることは止めたくない。",
    comment: "「これは自分の価値観なのか、それとも外から来たものか」——その問いを持てることは、自分の軸を探している証かもしれない。「ぐるぐる」の中に、かすかに「これは違う」と感じる瞬間はありますか。",
    emotions: [{ label: "混乱", score: 0.6 }, { label: "不安", score: 0.4 }, { label: "穏やか", score: 0.2 }],
    dominant: "混乱",
    energy: 4,
    createdAt: seedDate(6, "22:00:00"),
  },
  {
    id: "u-seed-2",
    content: "少し落ち着いて自分を観察してみようと思った。いつも感情に引きずられて、嫌なことがあるとそのことばかり考えてしまう。でも今日、少し距離を置いて「今の自分」を眺めてみたら、「あ、また同じパターンだ」と思えた瞬間があった。その瞬間だけ、ふっと楽になった気がした。",
    comment: "「また同じパターンだ」と気づいた瞬間——それは自分をすこし外から眺める目が生まれた瞬間かもしれない。「ふっと楽になった」という感覚は、何が変わったときに生まれたと感じますか。",
    emotions: [{ label: "希望", score: 0.5 }, { label: "穏やか", score: 0.4 }, { label: "混乱", score: 0.3 }],
    dominant: "希望",
    energy: 5,
    createdAt: seedDate(7, "20:00:00"),
  },
  {
    id: "u-seed-1",
    content: "感情がうまく扱えていない。些細なことで苛立ったり、理由もなく落ち込んだり。表では普通にしているつもりだけど、内側はずっとバラバラだ。自分が何を大切にして生きているのか、何のために頑張っているのかもわからなくなってきた。こんな状態がいつまで続くのだろう。",
    comment: "感情がバラバラに感じられ、価値観の軸が見えない状態。それでも「わからなくなった」と気づいていること自体、何かを探している自分がいるということ。今この感覚の中で、唯一「これだけは本物だ」と感じるものはありますか。",
    emotions: [{ label: "疲れ", score: 0.7 }, { label: "不安", score: 0.5 }, { label: "混乱", score: 0.4 }],
    dominant: "疲れ",
    energy: 3,
    createdAt: seedDate(8, "21:00:00"),
  },
];

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
  const [content, setContent] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("journal");
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserEmail(user.email ?? null);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      if (profile?.is_admin) setIsAdmin(true);
    };

    const loadEntries = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("entries")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        // Supabase は snake_case (created_at) で返すため camelCase (createdAt) にマップ
        setEntries(data.map(e => ({ ...e, createdAt: e.created_at })) as Entry[]);
      } else {
        // 初回ログイン時：SEEDデータをDBに保存
        const { data: { user: u } } = await supabase.auth.getUser();
        if (!u) return;
        const seeded = SEED_ENTRIES.map(e => ({
          id: e.id,
          user_id: u.id,
          content: e.content,
          comment: e.comment,
          emotions: e.emotions,
          dominant: e.dominant,
          energy: e.energy,
          created_at: e.createdAt,  // camelCase → snake_case
        }));
        await supabase.from("entries").insert(seeded);
        setEntries(SEED_ENTRIES);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const entry: Entry = {
        id: Date.now().toString(),
        content,
        comment:  data.comment,
        emotions: data.emotions || [],
        dominant: data.dominant || "穏やか",
        energy:   data.energy   || 5,
        createdAt: new Date().toISOString(),
      };

      await supabase.from("entries").insert({
        id:         entry.id,
        user_id:    user.id,
        content:    entry.content,
        comment:    entry.comment,
        emotions:   entry.emotions,
        dominant:   entry.dominant,
        energy:     entry.energy,
        created_at: entry.createdAt,  // camelCase → snake_case
      });
      setEntries([entry, ...entries]);
      setContent("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
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
        <div className="max-w-lg mx-auto px-6 pt-5 pb-0">
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
            <div className="flex items-center gap-3">
              {isAdmin && (
                <a href="/admin" className="text-xs tracking-widest px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  管理
                </a>
              )}
              {userEmail && (
                <a href="/account" className="text-xs tracking-widest px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                  設定
                </a>
              )}
              {userEmail && (
                <form action={logout}>
                  <button type="submit" className="text-xs tracking-widest px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                    ログアウト
                  </button>
                </form>
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

      <main className="max-w-lg mx-auto px-6 py-8 space-y-5">

        {/* ══════════════════════════════
            記録タブ
        ══════════════════════════════ */}
        {tab === "journal" && (
          <>
            {/* 入力エリア */}
            <div className="rounded-3xl p-6 shadow-sm"
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
                    className="rounded-3xl p-6 shadow-sm space-y-4"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: `1px solid ${highlightedEntryId === entry.id ? "var(--tab-active)" : "var(--border)"}`,
                      boxShadow: highlightedEntryId === entry.id ? "0 0 0 3px color-mix(in srgb, var(--tab-active) 20%, transparent)" : "none",
                      transition: "border-color 0.4s ease, box-shadow 0.4s ease",
                    }}>
                    <div className="flex items-center">
                      <time className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(entry.createdAt)}</time>
                    </div>

                    {/* 感情グラデーション */}
                    {entry.emotions?.length > 0 && (
                      <div className="h-1 rounded-full w-full"
                        style={{ background: emotionGradient(entry.emotions) }} />
                    )}

                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-entry)" }}>
                      {entry.content}
                    </p>

                    {/* 凪のコメント */}
                    <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-comment)" }}>
                      <p className="text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>凪より</p>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                        {entry.comment}
                      </p>
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
