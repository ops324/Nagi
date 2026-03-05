"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from "recharts";
import { Entry, EMOTION_COLORS } from "../types";

type Props = { entries: Entry[] };

export default function EmotionChart({ entries }: Props) {
  const recent = [...entries].reverse().slice(-14);

  const energyData = recent.map((e) => ({
    date: new Date(e.createdAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" }),
    energy: e.energy,
    dominant: e.dominant,
  }));

  const emotionCount: Record<string, number> = {};
  entries.forEach((e) => {
    if (e.dominant) emotionCount[e.dominant] = (emotionCount[e.dominant] || 0) + 1;
  });
  const radarData = Object.entries(emotionCount).map(([label, value]) => ({ label, value }));

  if (entries.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 text-center" style={{ border: "1px solid #ede9e3" }}>
        <p className="text-sm" style={{ color: "#b5afa8" }}>記録が増えると、ここにグラフが現れます</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* エネルギー推移 */}
      <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid #ede9e3" }}>
        <p className="text-sm font-light tracking-wide mb-5" style={{ color: "#78716c" }}>精神エネルギーの推移</p>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={energyData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="energyGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#7fcca4" stopOpacity={0.38} />
                <stop offset="55%"  stopColor="#e0b87c" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#e0b87c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#b5afa8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[1, 10]} tick={{ fontSize: 9, fill: "#b5afa8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 16, border: "1px solid #ede9e3", boxShadow: "none", backgroundColor: "rgba(255,255,255,0.95)" }}
              formatter={(v: number | undefined) => [`${v ?? ""} / 10`, "エネルギー"]}
            />
            <Area type="basis" dataKey="energy" stroke="#6ee7b7" strokeWidth={2} fill="url(#energyGrad2)" dot={false} animationDuration={1400} animationEasing="ease-out" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* 感情分布 */}
      {radarData.length >= 3 && (
        <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid #ede9e3" }}>
          <p className="text-sm font-light tracking-wide mb-4" style={{ color: "#78716c" }}>感情の分布</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
              <PolarGrid stroke="#f0ede8" />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: "#b5afa8" }} />
              <Radar dataKey="value" stroke="#6ee7b7" fill="#6ee7b7" fillOpacity={0.2} strokeWidth={1.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 感情ログ */}
      <div className="bg-white rounded-3xl p-6 shadow-sm" style={{ border: "1px solid #ede9e3" }}>
        <p className="text-sm font-light tracking-wide mb-5" style={{ color: "#78716c" }}>感情ログ</p>
        <div className="space-y-3">
          {[...entries].slice(0, 10).map((entry) => (
            <div key={entry.id} className="flex items-center gap-3">
              <span className="text-xs w-20 shrink-0" style={{ color: "#b5afa8" }}>
                {new Date(entry.createdAt).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
              <div className="flex gap-1.5 flex-wrap flex-1">
                {entry.emotions?.map((em) => (
                  <span key={em.label} className="text-xs px-2.5 py-0.5 rounded-full"
                    style={{ backgroundColor: `${EMOTION_COLORS[em.label] || "#d1fae5"}50`, color: "#78716c" }}>
                    {em.label}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EMOTION_COLORS[entry.dominant] || "#6ee7b7" }} />
                <span className="text-xs" style={{ color: "#b5afa8" }}>{entry.energy}/10</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
