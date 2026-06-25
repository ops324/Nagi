"use client";

import { useState } from "react";
import EntryCard from "@/app/components/EntryCard";
import Welcome from "@/app/components/Welcome";
import AccountMenu from "@/app/components/AccountMenu";
import EmotionFilter from "@/app/components/EmotionFilter";
import InputCard from "@/app/components/InputCard";
import MemoryCard from "@/app/components/MemoryCard";
import WeeklySummaryCard from "@/app/components/WeeklySummaryCard";
import TabBar from "@/app/components/ui/TabBar";
import SearchBar from "@/app/components/ui/SearchBar";
import { EMOTION_COLORS } from "@/app/types";
import type { Entry } from "@/app/types";

// 感情グラデーション生成（page.tsx と同じロジック）
function emotionGradient(emotions: Entry["emotions"]): string {
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
}

const SAMPLE_ENTRIES: Entry[] = [
  {
    id: "1",
    content:
      "今日は久しぶりに一人で喫茶店に行って、2時間ほど本を読んだ。窓から見える雨が、ゆっくりと流れていた。何かを達成したわけではないけれど、不思議なほど満たされた気持ちで店を出た。こういう時間が、自分には必要なのだと気づく。",
    comment:
      "雨の中、一人で本を読む時間を選んだのですね。「何も達成していない」という言葉と、「満たされた」という感覚が、静かに隣り合っています。その満たされ方は、どこから来ているのでしょうか。",
    emotions: [
      { label: "穏やか", score: 0.6 },
      { label: "充実", score: 0.3 },
      { label: "安心", score: 0.1 },
    ],
    dominant: "穏やか",
    energy: 7,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    insightLevel: "moderate",
    isFavorited: true,
    note: "雨の音を聞きながら読む時間が、こんなに自分を整えてくれるとは思わなかった。",
  },
  {
    id: "2",
    content:
      "上司に提出した資料を全部やり直すように言われた。何がいけなかったのか聞いても「全体的に」としか返ってこない。疲れた。もう帰りたい。",
    comment:
      "「全体的に」という言葉だけが返ってきたのですね。何を直せばよいかわからないまま、疲弊だけが積み重なっています。今、体のどこかに重さを感じますか。",
    emotions: [
      { label: "疲れ", score: 0.5 },
      { label: "混乱", score: 0.3 },
      { label: "不安", score: 0.2 },
    ],
    dominant: "疲れ",
    energy: 3,
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    insightLevel: "gentle",
    isFavorited: false,
  },
  {
    id: "3",
    content:
      "3ヶ月続けてきた早起きの習慣が、ついに崩れた。今朝は8時半まで寝てしまった。昨夜の飲み会が原因だとわかっているけれど、なぜこんなにも自分を責めているのだろう。1日くらい崩れても、3ヶ月は消えないはずなのに。「やってしまった」という感覚の根っこに、何があるのか気になる。",
    comment:
      "3ヶ月の積み重ねは、1日では消えません。それを知りながらも、「やってしまった」と感じる。その責める声は、どこから来ているのでしょうか。完璧でなければならないという前提が、どこかに隠れているのかもしれません。",
    emotions: [
      { label: "不安", score: 0.4 },
      { label: "希望", score: 0.4 },
      { label: "混乱", score: 0.2 },
    ],
    dominant: "希望",
    energy: 6,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    insightLevel: "deep",
    isFavorited: false,
  },
];

const THEMES = [
  { key: "light", label: "昼", cls: "v2-light" },
  { key: "morning", label: "朝", cls: "v2-morning" },
  { key: "evening", label: "夕", cls: "v2-evening" },
  { key: "dark", label: "夜", cls: "v2-dark" },
];

const TABS = [
  { key: "journal", label: "記録" },
  { key: "calendar", label: "カレンダー" },
  { key: "graph", label: "グラフ" },
];

// クリック位置から波紋を生成（既存 logout-ripple の汎用版）
function spawnRipple(e: React.PointerEvent<HTMLElement>) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const span = document.createElement("span");
  span.className = "v2-ripple";
  span.style.left = `${e.clientX - rect.left}px`;
  span.style.top = `${e.clientY - rect.top}px`;
  btn.appendChild(span);
  span.addEventListener("animationend", () => span.remove());
}

export default function PreviewPage() {
  const [theme, setTheme] = useState("light");
  const [version, setVersion] = useState<"v1" | "v2">("v2");
  const [tabKey, setTabKey] = useState("journal");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [inputContent, setInputContent] = useState("");
  // あの日の凪は「今日−Nヶ月」一致が必要。lazy init で1ヶ月前のサンプルを生成。
  // MemoryCard は時刻を表示しない（ラベル＋本文＋グラデのみ）ため SSR/client で同一描画＝ハイドレーション安全。
  const [memorySample] = useState<Entry[]>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return [{
      id: "memory-sample",
      content: "ひと月前の自分は、こんなことを書いていました。あの日の感覚を、今あらためて眺めてみる。",
      comment: "",
      emotions: [{ label: "穏やか", score: 0.6 }, { label: "希望", score: 0.4 }],
      dominant: "穏やか",
      energy: 5,
      createdAt: d.toISOString(),
      insightLevel: "moderate",
    }];
  });
  const [filterKey, setFilterKey] = useState<string | null>(null);
  const [toastOn, setToastOn] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(SAMPLE_ENTRIES.filter((e) => e.isFavorited).map((e) => e.id))
  );

  const themeCls = THEMES.find((t) => t.key === theme)?.cls ?? "";

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const showToast = () => {
    setToastOn(true);
    window.setTimeout(() => setToastOn(false), 2200);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#e9e6df" }}>
      {/* ── コントロールバー（ラボ操作。テーマ非依存の中立色） ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(245,243,238,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #ddd8d0",
          padding: "12px 16px",
        }}
      >
        <div className="max-w-lg mx-auto flex flex-wrap items-center gap-3">
          <span style={{ fontSize: 11, letterSpacing: "0.2em", color: "#78716c" }}>
            DESIGN LAB
          </span>

          {/* テーマ切替 */}
          <div className="flex gap-1">
            {THEMES.map((t) => (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  border: "1px solid",
                  borderColor: theme === t.key ? "#a8a29e" : "#ddd8d0",
                  background: theme === t.key ? "#44403c" : "transparent",
                  color: theme === t.key ? "#fff" : "#78716c",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Before / After */}
          <div className="flex gap-1 ml-auto">
            {(["v1", "v2"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVersion(v)}
                style={{
                  fontSize: 12,
                  padding: "4px 12px",
                  borderRadius: 9999,
                  border: "1px solid",
                  borderColor: version === v ? "#6ee7b7" : "#ddd8d0",
                  background: version === v ? "#6ee7b7" : "transparent",
                  color: version === v ? "#065f46" : "#78716c",
                  cursor: "pointer",
                  fontWeight: version === v ? 500 : 400,
                }}
              >
                {v === "v1" ? "Before" : "After"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── プレビュー面（テーマクラス + data-design スコープ。key で再マウントしアニメ再生） ── */}
      <div
        key={`${theme}-${version}`}
        className={themeCls}
        data-design={version}
        style={{ background: "var(--bg)", color: "var(--text-primary)", paddingBottom: 80 }}
      >
        <div className="max-w-lg mx-auto px-6 py-10 space-y-12">
          {/* 見出し */}
          <header>
            <p
              style={{
                fontSize: "var(--text-label)",
                letterSpacing: "0.3em",
                color: "var(--text-muted)",
              }}
            >
              NAGI · {version === "v2" ? "刷新案 (After)" : "現状相当 (Before)"}
            </p>
            <h1
              className="font-light"
              style={{
                fontSize: "1.4rem",
                letterSpacing: "0.12em",
                color: "var(--text-secondary)",
                marginTop: 4,
              }}
            >
              静けさを守りつつ、上質さを足す
            </h1>
          </header>

          {/* 1. Elevation スケール */}
          <Section title="奥行き（elevation）" caption="紙がそっと浮き沈みする段階。カードは最大3段、ダイアログのみ深く。">
            <div className="grid grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <div
                  key={n}
                  className={`v2-elev-${n}`}
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    height: 64,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "var(--text-muted)",
                  }}
                >
                  {n}
                </div>
              ))}
            </div>
          </Section>

          {/* 2. ボタン操作感 */}
          <Section title="操作感（ボタン）" caption="押すと沈み、波紋が広がる。hover で柔らかく明るむ。実際に押してみてください。">
            <div className="flex items-center gap-4 flex-wrap">
              <button className="v2-btn" onPointerDown={spawnRipple} style={{ padding: "10px 28px", fontSize: 13, letterSpacing: "0.1em" }}>
                記録する
              </button>
              <button
                className="v2-icon-btn"
                onPointerDown={spawnRipple}
                aria-label="共有"
                style={{ width: 44, height: 44, display: "grid", placeItems: "center", color: "var(--text-secondary)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
                </svg>
              </button>
              <button
                className="v2-icon-btn"
                onPointerDown={spawnRipple}
                aria-label="アカウント"
                style={{ width: 44, height: 44, display: "grid", placeItems: "center", color: "var(--text-secondary)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </button>
            </div>
          </Section>

          {/* 3. タブ（スライドインジケータ。本体と同じ TabBar・左寄せ可変幅で検証） */}
          <Section title="タブ" caption="下線が実寸を測ってアクティブタブへ滑る（左寄せ・可変幅。ホーム本体と同一コンポーネント）。">
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              <TabBar tabs={TABS} active={tabKey} onChange={setTabKey} ariaLabel="プレビュータブ" />
            </div>
          </Section>

          {/* 4. Dialog / Toast */}
          <Section title="ダイアログ・トースト" caption="出現はふっと膨らみながら（emphasized）。下のボタンで確認。">
            <div className="flex gap-4 flex-wrap">
              <button className="v2-btn" onPointerDown={spawnRipple} onClick={() => setDialogOpen(true)} style={{ padding: "9px 22px", fontSize: 13 }}>
                ダイアログを開く
              </button>
              <button
                className="v2-icon-btn"
                onPointerDown={spawnRipple}
                onClick={showToast}
                style={{ padding: "9px 22px", fontSize: 13, borderRadius: 9999, border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                トーストを出す
              </button>
            </div>
          </Section>

          {/* 5. 記録カード（stagger） */}
          <Section title="記録カード" caption="一覧はわずかな時間差で立ち上がる（stagger）。テーマや Before/After を切替えると再生されます。">
            <div className="v2-stagger space-y-5">
              {SAMPLE_ENTRIES.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={{ ...entry, isFavorited: favorites.has(entry.id) }}
                  emotionGradient={emotionGradient}
                  EMOTION_COLORS={EMOTION_COLORS}
                  onToggleFavorite={toggleFavorite}
                  onNoteChange={(id, value) => console.log("note:", id, value)}
                />
              ))}
            </div>
          </Section>

          {/* 6. ウェルカム画面（初回 0 件時のフルスクリーン・ホーム本体と同一コンポーネント） */}
          <Section title="ウェルカム画面" caption="記録 0 件時に出る初回案内。ホーム本体と同じ Welcome を描画（Radix Portal のため body 直下に出ます）。">
            <button
              className="v2-btn"
              onPointerDown={spawnRipple}
              onClick={() => setWelcomeOpen(true)}
              style={{ padding: "9px 22px", fontSize: 13 }}
            >
              ウェルカムを開く
            </button>
            <Welcome open={welcomeOpen} onOpenChange={setWelcomeOpen} />
          </Section>

          {/* 7. アカウントメニュー（ボトムシート・ホーム本体と同一コンポーネント） */}
          <Section title="アカウントメニュー" caption="ヘッダのアカウントアイコンから出るボトムシート。ホーム本体と同じ AccountMenu を描画（ログアウトは Server Action のためラボでは押さないでください）。">
            <button
              className="v2-btn"
              onPointerDown={spawnRipple}
              onClick={() => setAccountOpen(true)}
              style={{ padding: "9px 22px", fontSize: 13 }}
            >
              メニューを開く
            </button>
            <AccountMenu open={accountOpen} userEmail="user@example.com" onClose={() => setAccountOpen(false)} />
          </Section>

          {/* 8. 検索バー（記録一覧の全文検索・ホーム本体と同一コンポーネント） */}
          <Section title="検索バー" caption="記録一覧の全文検索。入力するとクリアボタン（×）が現れる。ホーム本体と同じ SearchBar を描画。">
            <SearchBar value={search} onChange={setSearch} />
          </Section>

          {/* 9. 感情フィルター（横スクロールのチップ群・ホーム本体と同一コンポーネント） */}
          <Section title="感情フィルター" caption="記録から導出した感情・お気に入り・深い気づきのチップ。タップで絞り込み（再タップで解除）。ホーム本体と同じ EmotionFilter を描画。">
            <EmotionFilter entries={SAMPLE_ENTRIES} filterKey={filterKey} onChange={setFilterKey} />
          </Section>

          {/* 10. 入力カード（今日の記録・ホーム本体と同一コンポーネント） */}
          <Section title="入力カード" caption="今日の記録の入力欄＋「記録する」ボタン（未入力時は非活性）。ホーム本体と同じ InputCard を描画（送信はラボでは無効）。">
            <InputCard
              content={inputContent}
              loading={false}
              loadingPhase={0}
              loadingQuestion={null}
              error=""
              onContentChange={setInputContent}
              onKeyDown={() => {}}
              onSubmit={() => {}}
            />
          </Section>

          {/* 11. あの日の凪（過去の同じ日の記録・ホーム本体と同一コンポーネント） */}
          <Section title="あの日の凪" caption="1年前／半年前／ひと月前の同じ日に記録があればカード表示（破線枠）。ホーム本体と同じ MemoryCard を描画（ラボではマウント後に1ヶ月前のサンプルを表示）。">
            <MemoryCard entries={memorySample} emotionGradient={emotionGradient} onNavigate={() => {}} />
          </Section>

          {/* 12. 今週の凪（週次サマリー・ホーム本体と同一コンポーネント） */}
          <Section title="今週の凪" caption="今週の記録が3件以上で出現。未生成時は「今週のことばを聞く」ボタン、生成後はサマリー本文（緑の左罫線）。ホーム本体と同じ WeeklySummaryCard を描画（ラボはサマリー表示状態）。">
            <WeeklySummaryCard
              entries={[]}
              summary="今週のあなたは、静かな揺らぎの中で小さな手応えを重ねていたようです。何度か立ち止まりながらも、そのつど自分の感覚に言葉を与えていました。"
              loading={false}
              onRequestSummary={() => {}}
            />
          </Section>
        </div>

        {/* Dialog */}
        {dialogOpen && (
          <div
            onClick={() => setDialogOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
              display: "grid",
              placeItems: "center",
              padding: 24,
            }}
          >
            <div
              className={version === "v2" ? "v2-dialog" : ""}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border)",
                boxShadow: version === "v2" ? "var(--shadow-5)" : "0 10px 40px rgba(0,0,0,0.2)",
                padding: 28,
                maxWidth: 360,
                width: "100%",
              }}
            >
              <h3 style={{ fontSize: "var(--text-title)", color: "var(--text-primary)", marginBottom: 10 }}>
                記録を削除しますか
              </h3>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 20 }}>
                この操作は取り消せません。静かに確認してから進めてください。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  className="v2-icon-btn"
                  onPointerDown={spawnRipple}
                  onClick={() => setDialogOpen(false)}
                  style={{ padding: "8px 18px", fontSize: 13, borderRadius: 9999, border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                >
                  とどまる
                </button>
                <button
                  className="v2-btn"
                  onPointerDown={spawnRipple}
                  onClick={() => setDialogOpen(false)}
                  style={{ padding: "8px 18px", fontSize: 13 }}
                >
                  削除する
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastOn && (
          <div
            className="toast-in"
            style={{
              position: "fixed",
              left: "50%",
              bottom: 24,
              transform: "translateX(-50%)",
              zIndex: 50,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 9999,
              boxShadow: version === "v2" ? "var(--shadow-3)" : "0 4px 16px rgba(0,0,0,0.12)",
              padding: "10px 22px",
              fontSize: 13,
              color: "var(--text-primary)",
            }}
          >
            記録を保存しました
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: "var(--text-body)", color: "var(--text-primary)", letterSpacing: "0.08em", marginBottom: 4 }}>
        {title}
      </h2>
      <p style={{ fontSize: "var(--text-meta)", color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.7 }}>
        {caption}
      </p>
      {children}
    </section>
  );
}
