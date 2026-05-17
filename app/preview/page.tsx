"use client";

import { useState } from "react";
import EntryCard from "@/app/components/EntryCard";
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

export default function PreviewPage() {
  const [favorites, setFavorites] = useState<Set<string>>(
    new Set(SAMPLE_ENTRIES.filter((e) => e.isFavorited).map((e) => e.id))
  );

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="min-h-screen py-12 px-6"
      style={{ backgroundColor: "var(--bg)" }}
    >
      <div className="max-w-lg mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="mb-10">
          <p
            className="text-xs tracking-[0.3em] mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            DESIGN PREVIEW
          </p>
          <h1
            className="text-xl font-light tracking-[0.15em]"
            style={{ color: "var(--text-secondary)" }}
          >
            EntryCard ショーケース
          </h1>
          <p className="text-xs mt-2" style={{ color: "var(--text-subtle)" }}>
            3種類のinsightLevel（moderate / gentle / deep）とエネルギーレベルの違いを確認
          </p>
        </div>

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
    </div>
  );
}
