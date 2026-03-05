"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Entry, Emotion, EMOTION_COLORS } from "./types";
import { createClient } from "@/lib/supabase/client";
import { logout } from "./auth/actions";

const SEED_ENTRIES: Entry[] = [
  {
    id: "seed-8",
    content: "少し前の自分と今の自分を比べると、確かに変わっている。2週間前は何も感じなかったのに、今日は外の空気が気持ちいいと思えた。誰かに感謝というよりも、諦めなかった自分に少しだけ感謝したい気持ちがある。記録してきてよかった。",
    comment: "日々の積み重ねを振り返ったとき、確かに何かが変わっていることに気づけた。感謝というのは、過去の自分と今の自分の間にある距離を、静かに認める行為かもしれない。この変化の中で、最も大切だと感じているものは何ですか。",
    emotions: [{ label: "感謝", score: 0.7 }, { label: "充実", score: 0.5 }, { label: "喜び", score: 0.4 }],
    dominant: "感謝",
    energy: 8,
    createdAt: "2026-03-05T12:00:00+09:00",
  },
  {
    id: "seed-7",
    content: "仕事でずっと詰まっていた問題が解決した。チームで相談してもわからなくて、昨日の夜ひとりでもう一度ゼロから考え直したら、今日の朝に急にわかった。解決した後、自分に「よくやった」と言えた。口には出してないけど、ちゃんと言えた気がする。",
    comment: "仕事の中で自分の力を信じて動いて、最後に自分自身に言葉をかけられた——そういう日があったのですね。問題を解いた後の感覚と、自分に言葉をかけた後の感覚は、同じでしたか、それとも違いましたか。",
    emotions: [{ label: "喜び", score: 0.7 }, { label: "充実", score: 0.5 }, { label: "安心", score: 0.3 }],
    dominant: "喜び",
    energy: 8,
    createdAt: "2026-03-03T13:00:00+09:00",
  },
  {
    id: "seed-6",
    content: "今朝、起きたとき身体が軽かった。最近はベッドから出るのも重かったのに、なんか違った。何かが変わったわけじゃないけど、焦りが少しほどけてきた感じ。あわてなくていいと思えた。",
    comment: "朝起きたとき、身体が少し軽かった。その感覚は、何かが少しずつ変わってきているサインかもしれない。焦りがほどけていくとき、あなたの中では何が変化しているのでしょう。その「軽さ」は、どんな瞬間に宿りましたか。",
    emotions: [{ label: "希望", score: 0.6 }, { label: "安心", score: 0.5 }, { label: "穏やか", score: 0.3 }],
    dominant: "希望",
    energy: 7,
    createdAt: "2026-03-01T07:30:00+09:00",
  },
  {
    id: "seed-5",
    content: "大学の友人とカフェで3時間くらい話した。近況を話していたら、向こうに「あなたっていつもそういうときどうするの」と聞かれて、答えながら自分のことをはっきり理解できた気がした。誰かに語るって、自分を知ることなんだな。",
    comment: "誰かと話す中で、自分の輪郭がはっきりしてくる瞬間がある。今日の友人との会話は、鏡のような役割を果たしてくれたのかもしれない。会話の中で出てきた言葉の中に、「これが自分だ」と感じたものはありましたか。",
    emotions: [{ label: "充実", score: 0.7 }, { label: "感謝", score: 0.5 }, { label: "安心", score: 0.3 }],
    dominant: "充実",
    energy: 7,
    createdAt: "2026-02-28T15:30:00+09:00",
  },
  {
    id: "seed-4",
    content: "夕飯を一から作った。最近はコンビニやデリバリーばかりだったので久しぶり。野菜を切っているとき、頭が空っぽになって気持ちよかった。出来上がりよりも、作っている時間の方が好きかもしれないと気づいた。結果じゃなくて過程が好きなんだな、と。",
    comment: "料理をしながら「過程そのものが好き」という感覚に気づいた日。手を動かすことで、頭の中が整理されていくような感覚はありましたか。「結果より過程」——それは他のどんな場面にも当てはまりそうですか。",
    emotions: [{ label: "充実", score: 0.6 }, { label: "穏やか", score: 0.4 }, { label: "安心", score: 0.3 }],
    dominant: "充実",
    energy: 6,
    createdAt: "2026-02-26T19:30:00+09:00",
  },
  {
    id: "seed-3",
    content: "積んでいた本をやっと読み始めた。哲学系の本で、正直難しかったけど、途中で「これまで自分が聞いていた問いそのものが間違っていたかもしれない」という一節に引っかかった。何かが少し変わった気がする。問いの立て方が変わると、見える景色も変わるんだろうか。",
    comment: "読んでいた本が、何かのスイッチを押したのかもしれない。「問いが変わった」という感覚は、物の見え方そのものが変わる瞬間に近い。今、あなたの中で変化した「問いの立て方」を言葉にすると、どんなものになりますか。",
    emotions: [{ label: "希望", score: 0.6 }, { label: "混乱", score: 0.3 }, { label: "穏やか", score: 0.3 }],
    dominant: "希望",
    energy: 6,
    createdAt: "2026-02-24T21:00:00+09:00",
  },
  {
    id: "seed-2",
    content: "午後から少し外を歩いた。最近ずっと家にいたから、久しぶりに空気を吸った気がした。川沿いの道で、水面がきらきらしていて、ぼーっと眺めていたら気がついたら30分経っていた。特別なことは何もないけど、少しだけ息ができた感じがした。",
    comment: "外に出て歩いてみたら、少し呼吸が楽になった。身体はときどき、言葉より先に「今は外が必要だ」と知っているのかもしれない。散歩の途中で目に留まったものや感じた空気感の中に、何か小さな発見はありましたか。",
    emotions: [{ label: "穏やか", score: 0.6 }, { label: "安心", score: 0.4 }],
    dominant: "穏やか",
    energy: 5,
    createdAt: "2026-02-22T15:00:00+09:00",
  },
  {
    id: "seed-1",
    content: "最近、何をしていても気持ちが乗らない。仕事も、食事も、全部義務みたいな感覚で済ませている。好きなものを見ても何も感じなくて、毎日がただ過ぎていく。これがずっと続くのかと思うと少し怖い。",
    comment: "気力も意欲もどこかへ行ってしまったような日々。そういう感覚の中でも、今日ここに言葉を残したことがある。この「何もかも遠い」という感じは、身体の疲れと地続きになっていますか、それとも別の何かでしょうか。",
    emotions: [{ label: "疲れ", score: 0.7 }, { label: "孤独", score: 0.4 }, { label: "不安", score: 0.3 }],
    dominant: "疲れ",
    energy: 3,
    createdAt: "2026-02-20T20:30:00+09:00",
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
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
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
        setEntries(data as Entry[]);
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

      await supabase.from("entries").insert({ ...entry, user_id: user.id });
      setEntries([entry, ...entries]);
      setContent("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

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
              <div className="icon-anim w-9 h-9">
                <img src="/icon.png" alt="Nagi" className="w-9 h-9 block rounded-xl" />
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
                  <article key={entry.id} className="rounded-3xl p-6 shadow-sm space-y-4"
                    style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
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
              onSelectEntry={(e) => setSelectedEntry(e)}
            />

            {/* 選択した記録 */}
            {selectedEntry && (
              <article className="rounded-3xl p-6 shadow-sm space-y-4"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex justify-between items-center">
                  <time className="text-xs" style={{ color: "var(--text-muted)" }}>{fmtDate(selectedEntry.createdAt)}</time>
                  <button onClick={() => setSelectedEntry(null)} style={{ color: "var(--text-subtle)", fontSize: 12 }}>✕</button>
                </div>
                {selectedEntry.emotions?.length > 0 && (
                  <div className="h-1 rounded-full w-full"
                    style={{ background: emotionGradient(selectedEntry.emotions) }} />
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-entry)" }}>
                  {selectedEntry.content}
                </p>
                <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg-comment)" }}>
                  <p className="text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>凪より</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>
                    {selectedEntry.comment}
                  </p>
                </div>
              </article>
            )}

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
