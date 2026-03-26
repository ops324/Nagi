"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { Entry, EMOTION_COLORS } from "../types";

type Props = {
  entries: Entry[];
  onNavigateToEntry: (entry: Entry) => void;
};

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number; payload: { date: string; dominant: string } }[] }) => {
  if (active && payload?.length) {
    const { date, dominant } = payload[0].payload;
    return (
      <div style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "1rem",
        padding: "6px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        fontSize: 11,
        color: "var(--text-muted)",
        backdropFilter: "blur(8px)",
      }}>
        <p>{date}</p>
        <p style={{ color: EMOTION_COLORS[dominant] || "#6ee7b7", fontWeight: 500 }}>{dominant}</p>
      </div>
    );
  }
  return null;
};

export default function EmotionCalendar({ entries, onNavigateToEntry }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 1日に複数エントリがある場合、全エントリの感情を集約して代表色を算出
  const entriesGroupedByDate: Record<string, Entry[]> = {};
  entries.forEach((entry) => {
    const d = new Date(entry.createdAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate().toString();
      if (!entriesGroupedByDate[key]) entriesGroupedByDate[key] = [];
      entriesGroupedByDate[key].push(entry);
    }
  });

  // 日ごとの代表感情を算出（全エントリの感情スコアを合算し、最高スコアのラベルを代表とする）
  const dailyDominant: Record<string, string> = {};
  const dailyFirstEntry: Record<string, Entry> = {}; // ナビゲーション用（最新エントリ）
  Object.keys(entriesGroupedByDate).forEach((key) => {
    const dayEntries = entriesGroupedByDate[key];
    // 最新エントリをナビゲーション用に保持
    dailyFirstEntry[key] = dayEntries.reduce((latest, e) =>
      new Date(e.createdAt) > new Date(latest.createdAt) ? e : latest
    );
    // 全エントリの感情スコアを合算
    const scoreMap: Record<string, number> = {};
    dayEntries.forEach((entry) => {
      (entry.emotions || []).forEach((em) => {
        scoreMap[em.label] = (scoreMap[em.label] || 0) + em.score;
      });
    });
    // 最高スコアの感情ラベルを代表とする
    let maxLabel = dayEntries[0]?.dominant || "穏やか";
    let maxScore = 0;
    Object.entries(scoreMap).forEach(([label, score]) => {
      if (score > maxScore) { maxScore = score; maxLabel = label; }
    });
    dailyDominant[key] = maxLabel;
  });

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const dayNames = ["日","月","火","水","木","金","土"];
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // グラフデータ：1日複数エントリがある場合はエネルギーを平均、感情を総合して表示
  const chartData = (() => {
    const byDate: Record<string, { entries: Entry[]; dateStr: string }> = {};
    [...entries].reverse().forEach((e) => {
      const dateStr = new Date(e.createdAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
      const dateKey = new Date(e.createdAt).toISOString().slice(0, 10);
      if (!byDate[dateKey]) byDate[dateKey] = { entries: [], dateStr };
      byDate[dateKey].entries.push(e);
    });
    return Object.values(byDate).slice(-30).map(({ entries: dayEntries, dateStr }) => {
      const avgEnergy = Math.round(dayEntries.reduce((s, e) => s + (e.energy ?? 5), 0) / dayEntries.length);
      // 感情スコアを合算して代表感情を決定
      const scoreMap: Record<string, number> = {};
      dayEntries.forEach((e) => {
        (e.emotions || []).forEach((em) => {
          scoreMap[em.label] = (scoreMap[em.label] || 0) + em.score;
        });
      });
      let dominant = dayEntries[0]?.dominant || "穏やか";
      let maxScore = 0;
      Object.entries(scoreMap).forEach(([label, score]) => {
        if (score > maxScore) { maxScore = score; dominant = label; }
      });
      return {
        id: dayEntries[dayEntries.length - 1].id, // 最新エントリのIDをナビゲーション用に使用
        date: dateStr,
        energy: avgEnergy,
        dominant,
      };
    });
  })();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartClick = (data: any) => {
    if (data?.activePayload?.[0]) {
      const id = data.activePayload[0].payload.id;
      const entry = entries.find((e) => e.id === id);
      if (entry) onNavigateToEntry(entry);
    }
  };

  // 感情カラーのグラデーションストップ（横方向）
  const gradientStops = chartData.map((d, i) => ({
    offset: `${(i / Math.max(chartData.length - 1, 1)) * 100}%`,
    color: EMOTION_COLORS[d.dominant] || "#6ee7b7",
  }));
  const lastColor = gradientStops[gradientStops.length - 1]?.color || "#6ee7b7";

  const mutedColor  = isDark ? "#6b6560" : "#b5afa8";
  const textColor   = isDark ? "#9c948c" : "#78716c";

  return (
    <div className="space-y-4 pb-24">
      {/* ── グラフ ── */}
      <div className="rounded-3xl p-6 shadow-sm"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-light tracking-wide mb-5" style={{ color: textColor }}>最近の心の動き</p>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -30, bottom: 0 }} onClick={handleChartClick} style={{ cursor: "pointer" }}>
              <defs>
                {/* 横方向：感情カラーグラデーション（ライン用） */}
                <linearGradient id="emotionStroke" x1="0" y1="0" x2="1" y2="0">
                  {gradientStops.map((s, i) => (
                    <stop key={i} offset={s.offset} stopColor={s.color} />
                  ))}
                </linearGradient>
                {/* 縦方向：淡いグリーン→淡いオレンジ→透明（塗り用・感情色に依存しない穏やかな配色） */}
                <linearGradient id="emotionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#7fcca4" stopOpacity={0.38} />
                  <stop offset="55%"  stopColor="#e0b87c" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#e0b87c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: mutedColor }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="basis"
                dataKey="energy"
                stroke="url(#emotionStroke)"
                strokeWidth={2}
                fill="url(#emotionFill)"
                dot={false}
                animationDuration={1400}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center">
            <p className="text-sm" style={{ color: mutedColor }}>記録が増えるとグラフが現れます</p>
          </div>
        )}
      </div>

      {/* ── カレンダー ── */}
      <div className="rounded-3xl p-6 shadow-sm"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {/* ナビ */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm"
            style={{ color: mutedColor }}
          >
            ‹
          </button>
          <p className="text-sm font-light tracking-widest" style={{ color: textColor }}>
            {year}年 {month + 1}月
          </p>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all text-sm"
            style={{ color: mutedColor }}
          >
            ›
          </button>
        </div>

        {/* 曜日 */}
        <div className="grid grid-cols-7 mb-2">
          {dayNames.map((d, i) => (
            <div key={d} className="text-center text-xs py-1"
              style={{ color: i === 0 ? "#fca5a5" : i === 6 ? "#93c5fd" : mutedColor }}>
              {d}
            </div>
          ))}
        </div>

        {/* 日付 */}
        <div className="grid grid-cols-7 gap-y-2">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />;
            const dayKey = day.toString();
            const hasEntries = !!entriesGroupedByDate[dayKey];
            const dominant = dailyDominant[dayKey];
            const navEntry = dailyFirstEntry[dayKey];
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const bgColor = hasEntries ? (EMOTION_COLORS[dominant] || "#d1fae5") : "transparent";

            return (
              <button
                key={day}
                onClick={() => navEntry && onNavigateToEntry(navEntry)}
                className="mx-auto w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={{
                  backgroundColor: hasEntries ? bgColor : isToday ? "rgba(110, 231, 183, 0.15)" : "transparent",
                  boxShadow: isToday && hasEntries
                    ? `0 0 0 2px white, 0 0 0 4px ${bgColor}`
                    : isToday
                    ? `0 0 0 2px #6ee7b7`
                    : "none",
                  opacity: hasEntries ? 1 : isToday ? 1 : 0.7,
                  cursor: hasEntries ? "pointer" : "default",
                }}
              >
                <span className="text-xs" style={{
                  color: hasEntries ? "#44403c" : isToday ? "#5ec89a" : mutedColor,
                  fontWeight: (hasEntries || isToday) ? 600 : 400,
                }}>
                  {day}
                </span>
              </button>
            );
          })}
        </div>

        {/* 凡例：色相順グラデーションバー */}
        {(() => {
          // 色相環順（グリーン→ブルー→パープル→グレー→ローズ→アンバー→ゴールド）で並べる
          const order = ["充実","穏やか","悲しみ","孤独","不安","混乱","疲れ","怒り","希望","喜び"];
          const gradientCss = order.map(l => EMOTION_COLORS[l]).join(", ");
          return (
            <div className="mt-6 pt-4" style={{ borderTop: "1px solid var(--border-inner)" }}>
              {/* グラデーションバー */}
              <div className="h-1.5 rounded-full mb-3"
                style={{ background: `linear-gradient(to right, ${gradientCss})` }} />
              {/* ラベル */}
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {order.map((label) => (
                  <div key={label} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: EMOTION_COLORS[label] }} />
                    <span className="text-xs" style={{ color: mutedColor }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
