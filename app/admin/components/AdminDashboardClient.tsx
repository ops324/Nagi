"use client";

import Link from "next/link";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { EMOTION_COLORS } from "../../types";
import type { AdminDashboardData, EmotionEnergy } from "../types";

const TOOLTIP_STYLE = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
};

const CARD_STYLE = {
  backgroundColor: "var(--bg-card)",
  border: "1px solid var(--border)",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });

export default function AdminDashboardClient({ data }: { data: AdminDashboardData }) {
  const {
    users, emotions, energyTrend, hourDist, weekDayDist,
    contentLenDist, emotionEnergy, churnBuckets, retention, summary,
  } = data;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>

      {/* ヘッダー */}
      <header className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--bg-header)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extralight tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>管理者ダッシュボード</h1>
            <p className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>Nagi Analytics</p>
          </div>
          <Link href="/" className="text-xs tracking-widest px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            ← アプリへ
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* サマリーカード */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "総ユーザー数",     value: summary.totalUsers },
            { label: "アクティブ（7日）", value: summary.activeUsers },
            { label: "総記録数",          value: summary.totalEntries },
            { label: "平均記録数/人",     value: summary.avgPerUser },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-3xl p-5" style={CARD_STYLE}>
              <p className="text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>{label}</p>
              <p className="text-2xl font-extralight" style={{ color: "var(--text-secondary)" }}>{value}</p>
            </div>
          ))}
        </div>

        {/* リテンション率 */}
        <div>
          <p className="text-xs tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>リテンション率</p>
          <div className="grid grid-cols-3 gap-4">
            {retention.map(r => (
              <div key={r.label} className="rounded-3xl p-5" style={CARD_STYLE}>
                <p className="text-xs tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>{r.label}</p>
                <p className="text-xs mb-3" style={{ color: "var(--text-subtle)" }}>{r.sublabel}</p>
                <p className="text-3xl font-extralight" style={{ color: "var(--text-secondary)" }}>
                  {r.rate}<span className="text-base">%</span>
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-subtle)" }}>{r.count} / {r.total} 人</p>
              </div>
            ))}
          </div>
        </div>

        {/* 感情分布 & エネルギー推移 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

          {/* 感情分布 円グラフ */}
          <div className="rounded-3xl p-6" style={CARD_STYLE}>
            <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>感情分布（全ユーザー）</p>
            {emotions.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={emotions} dataKey="count" nameKey="emotion_label" cx="50%" cy="50%" outerRadius={80}>
                      {emotions.map(entry => (
                        <Cell key={entry.emotion_label} fill={EMOTION_COLORS[entry.emotion_label] || "#d1d5db"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-3">
                  {emotions.slice(0, 6).map(e => (
                    <div key={e.emotion_label} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EMOTION_COLORS[e.emotion_label] || "#d1d5db" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{e.emotion_label}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-center py-16" style={{ color: "var(--text-subtle)" }}>データなし</p>
            )}
          </div>

          {/* エネルギー推移 */}
          <div className="rounded-3xl p-6" style={CARD_STYLE}>
            <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>エネルギー推移（全体・日別平均）</p>
            {energyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={energyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} interval="preserveStartEnd" />
                  <YAxis domain={[1, 10]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={24} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="avg_energy" stroke="#6ee7b7" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-center py-16" style={{ color: "var(--text-subtle)" }}>データなし</p>
            )}
          </div>
        </div>

        {/* 感情×平均エネルギー */}
        <div className="rounded-3xl p-6" style={CARD_STYLE}>
          <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>感情×平均エネルギー</p>
          {emotionEnergy.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={emotionEnergy} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="emotion" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: "var(--text-muted)" }} width={24} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value, name, props) => [
                    `${value}（n=${(props.payload as EmotionEnergy).count}）`,
                    "平均エネルギー",
                  ]}
                />
                <Bar dataKey="avg_energy" radius={[6, 6, 0, 0]}>
                  {emotionEnergy.map(e => (
                    <Cell key={e.emotion} fill={EMOTION_COLORS[e.emotion] || "#d1d5db"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-center py-16" style={{ color: "var(--text-subtle)" }}>データなし</p>
          )}
        </div>

        {/* 時間帯分布 & 曜日分布 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

          <div className="rounded-3xl p-6" style={CARD_STYLE}>
            <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>記録の時間帯分布</p>
            {hourDist.some(h => h.count > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourDist} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "var(--text-muted)" }} interval={3} tickFormatter={h => `${h}h`} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "記録数"]} labelFormatter={l => `${l}時台`} />
                  <Bar dataKey="count" fill="#6ee7b7" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-center py-12" style={{ color: "var(--text-subtle)" }}>データなし</p>
            )}
          </div>

          <div className="rounded-3xl p-6" style={CARD_STYLE}>
            <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>記録の曜日分布</p>
            {weekDayDist.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={weekDayDist} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "記録数"]} />
                  <Bar dataKey="count" fill="#fde68a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-center py-12" style={{ color: "var(--text-subtle)" }}>データなし</p>
            )}
          </div>
        </div>

        {/* 文字数分布 & チャーン分析 */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

          <div className="rounded-3xl p-6" style={CARD_STYLE}>
            <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>記録の文字数分布</p>
            {contentLenDist.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={contentLenDist} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "記録数"]} />
                  <Bar dataKey="count" fill="#9698c4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-center py-12" style={{ color: "var(--text-subtle)" }}>データなし</p>
            )}
          </div>

          <div className="rounded-3xl p-6" style={CARD_STYLE}>
            <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>ユーザー活動状況（最終記録）</p>
            {churnBuckets.some(b => b.count > 0) ? (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={churnBuckets} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 10, fill: "var(--text-muted)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)" }} width={20} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v, "ユーザー数"]} />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {churnBuckets.map(b => (
                      <Cell key={b.range} fill={b.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-center py-12" style={{ color: "var(--text-subtle)" }}>データなし</p>
            )}
          </div>
        </div>

        {/* ユーザー一覧 */}
        <div className="rounded-3xl p-6" style={CARD_STYLE}>
          <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>ユーザー一覧</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: "var(--text-secondary)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["メールアドレス", "登録日", "記録数", "最終記録", "平均エネルギー"].map(h => (
                    <th key={h} className="pb-3 pr-4 text-left tracking-widest font-normal"
                      style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.user_id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-3 pr-4">{u.email}</td>
                    <td className="py-3 pr-4">{fmtDate(u.registered_at)}</td>
                    <td className="py-3 pr-4">{u.total_entries}</td>
                    <td className="py-3 pr-4">{u.last_entry_at ? fmtDate(u.last_entry_at) : "—"}</td>
                    <td className="py-3">{u.avg_energy ? Number(u.avg_energy).toFixed(1) : "—"}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center" style={{ color: "var(--text-subtle)" }}>ユーザーなし</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}
