"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { EMOTION_COLORS } from "../types";

type UserRow = {
  user_id: string;
  email: string;
  registered_at: string;
  total_entries: number;
  last_entry_at: string | null;
  avg_energy: number | null;
};

type EmotionRow = { emotion_label: string; count: number };
type EnergyTrend = { date: string; avg_energy: number };
type HourDist = { hour: string; count: number };
type WeekDayDist = { day: string; count: number };
type ContentLenDist = { range: string; count: number };
type EmotionEnergy = { emotion: string; avg_energy: number; count: number };
type ChurnBucket = { range: string; count: number; color: string };
type RetentionData = { label: string; sublabel: string; rate: number; count: number; total: number };

type EntryRaw = {
  user_id: string;
  content: string;
  energy: number;
  dominant: string;
  created_at: string;
};

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

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [emotions, setEmotions] = useState<EmotionRow[]>([]);
  const [energyTrend, setEnergyTrend] = useState<EnergyTrend[]>([]);
  const [hourDist, setHourDist] = useState<HourDist[]>([]);
  const [weekDayDist, setWeekDayDist] = useState<WeekDayDist[]>([]);
  const [contentLenDist, setContentLenDist] = useState<ContentLenDist[]>([]);
  const [emotionEnergy, setEmotionEnergy] = useState<EmotionEnergy[]>([]);
  const [churnBuckets, setChurnBuckets] = useState<ChurnBucket[]>([]);
  const [retention, setRetention] = useState<RetentionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      // 認証 + 管理者権限チェックは layout.tsx で完了済み。userId 取得のみ行う
      const { data: claimsData, error } = await supabase.auth.getClaims();
      if (error || !claimsData?.claims) return;

      // ユーザー一覧
      const { data: usersData } = await supabase
        .from("admin_analytics")
        .select("*")
        .order("registered_at", { ascending: false });
      const userList = (usersData as UserRow[]) || [];
      setUsers(userList);

      // 感情分布
      const { data: emotionData } = await supabase
        .from("admin_emotion_stats")
        .select("*");
      setEmotions((emotionData as EmotionRow[]) || []);

      // 全エントリ（各種分析用）
      const { data: allEntries } = await supabase
        .from("entries")
        .select("user_id, content, energy, dominant, created_at")
        .order("created_at", { ascending: true });
      const entries = (allEntries as EntryRaw[]) || [];

      // --- エネルギー推移（日別平均）---
      const energyByDay: Record<string, number[]> = {};
      entries.forEach(e => {
        const day = e.created_at.slice(0, 10);
        if (!energyByDay[day]) energyByDay[day] = [];
        energyByDay[day].push(e.energy);
      });
      setEnergyTrend(
        Object.entries(energyByDay).map(([date, vals]) => ({
          date: date.slice(5),
          avg_energy: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
        })).slice(-30)
      );

      // --- 時間帯分布 ---
      const hourCounts: Record<number, number> = {};
      entries.forEach(e => {
        const h = new Date(e.created_at).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      });
      setHourDist(
        Array.from({ length: 24 }, (_, h) => ({
          hour: `${h}`,
          count: hourCounts[h] || 0,
        }))
      );

      // --- 曜日分布（月始まり）---
      const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
      const dayCounts: Record<number, number> = {};
      entries.forEach(e => {
        const d = new Date(e.created_at).getDay();
        dayCounts[d] = (dayCounts[d] || 0) + 1;
      });
      setWeekDayDist(
        [1, 2, 3, 4, 5, 6, 0].map(i => ({
          day: DAYS[i],
          count: dayCounts[i] || 0,
        }))
      );

      // --- テキスト文字数分布 ---
      setContentLenDist([
        { range: "〜50字",    count: entries.filter(e => e.content.length <= 50).length },
        { range: "51〜150字", count: entries.filter(e => e.content.length > 50 && e.content.length <= 150).length },
        { range: "151〜300字",count: entries.filter(e => e.content.length > 150 && e.content.length <= 300).length },
        { range: "301字〜",   count: entries.filter(e => e.content.length > 300).length },
      ]);

      // --- 感情×平均エネルギー ---
      const eeMap: Record<string, number[]> = {};
      entries.forEach(e => {
        if (!e.dominant) return;
        if (!eeMap[e.dominant]) eeMap[e.dominant] = [];
        eeMap[e.dominant].push(e.energy);
      });
      setEmotionEnergy(
        Object.entries(eeMap).map(([emotion, vals]) => ({
          emotion,
          avg_energy: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
          count: vals.length,
        })).sort((a, b) => b.avg_energy - a.avg_energy)
      );

      // --- チャーン分析 ---
      const now = Date.now();
      const churnDefs = [
        { range: "今日",    color: "#6ee7b7", test: (d: number) => d < 1 },
        { range: "2〜7日",  color: "#fde68a", test: (d: number) => d >= 1 && d <= 7 },
        { range: "8〜30日", color: "#f0a84e", test: (d: number) => d > 7 && d <= 30 },
        { range: "30日超",  color: "#c49494", test: (d: number) => isFinite(d) && d > 30 },
        { range: "未記録",  color: "#b5afa8", test: (d: number) => !isFinite(d) },
      ];
      const churnCounts: ChurnBucket[] = churnDefs.map(d => ({ range: d.range, color: d.color, count: 0 }));
      userList.forEach(u => {
        const days = u.last_entry_at
          ? (now - new Date(u.last_entry_at).getTime()) / 86400000
          : Infinity;
        const idx = churnDefs.findIndex(d => d.test(days));
        if (idx >= 0) churnCounts[idx].count++;
      });
      setChurnBuckets(churnCounts);

      // --- リテンション率（登録後N日以降も記録したか）---
      const userMaxEntry: Record<string, string> = {};
      entries.forEach(e => {
        if (!userMaxEntry[e.user_id] || e.created_at > userMaxEntry[e.user_id]) {
          userMaxEntry[e.user_id] = e.created_at;
        }
      });
      setRetention(
        [
          { label: "Day 1",  sublabel: "翌日以降も記録",   days: 1 },
          { label: "Day 7",  sublabel: "1週間後も記録",    days: 7 },
          { label: "Day 30", sublabel: "1ヶ月後も記録",    days: 30 },
        ].map(({ label, sublabel, days }) => {
          const count = userList.filter(u => {
            const last = userMaxEntry[u.user_id];
            if (!last) return false;
            const diff = (new Date(last).getTime() - new Date(u.registered_at).getTime()) / 86400000;
            return diff >= days;
          }).length;
          return {
            label, sublabel, count,
            total: userList.length,
            rate: userList.length > 0 ? Math.round((count / userList.length) * 100) : 0,
          };
        })
      );

      setLoading(false);
    };

    load();
  }, []);

  const totalEntries = users.reduce((s, u) => s + Number(u.total_entries), 0);
  const activeUsers = users.filter(u => {
    if (!u.last_entry_at) return false;
    return (Date.now() - new Date(u.last_entry_at).getTime()) / 86400000 <= 7;
  }).length;

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>読み込み中…</p>
      </div>
    );
  }

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
          <a href="/" className="text-xs tracking-widest px-3 py-1.5 rounded-full"
            style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            ← アプリへ
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">

        {/* サマリーカード */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "総ユーザー数",     value: users.length },
            { label: "アクティブ（7日）", value: activeUsers },
            { label: "総記録数",          value: totalEntries },
            { label: "平均記録数/人",     value: users.length ? (totalEntries / users.length).toFixed(1) : "0" },
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
