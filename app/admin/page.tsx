import { createClient } from "@/lib/supabase/server";
import AdminDashboardClient from "./components/AdminDashboardClient";
import type {
  UserRow, EmotionRow, EnergyTrend, HourDist, WeekDayDist,
  ContentLenDist, EmotionEnergy, ChurnBucket, RetentionData, AdminDashboardData,
} from "./types";

type EntryRaw = {
  user_id: string;
  content: string;
  energy: number;
  dominant: string;
  created_at: string;
};

// created_at(ISO/UTC) を JST(UTC+9) の時刻・曜日に変換する。
// 旧実装は管理者ブラウザ(JST)の getHours()/getDay() に依存していたため、
// サーバー集計でも JST を明示して同一の集計結果を保つ。
function jstParts(iso: string): { hour: number; day: number } {
  const shifted = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  return { hour: shifted.getUTCHours(), day: shifted.getUTCDay() };
}

export default async function AdminPage() {
  const supabase = await createClient();

  // 認証 + 管理者権限チェックは layout.tsx で完了済み。
  // データ参照は RLS の is_admin() バイパスに依存する。
  const [{ data: usersData }, { data: emotionData }, { data: allEntries }] = await Promise.all([
    supabase.from("admin_analytics").select("*").order("registered_at", { ascending: false }),
    supabase.from("admin_emotion_stats").select("*"),
    supabase.from("entries").select("user_id, content, energy, dominant, created_at").order("created_at", { ascending: true }),
  ]);

  const users = (usersData as UserRow[]) || [];
  const emotions = (emotionData as EmotionRow[]) || [];
  const entries = (allEntries as EntryRaw[]) || [];

  // --- エネルギー推移（日別平均。created_at の UTC 日付で集計：旧実装の slice(0,10) を踏襲）---
  const energyByDay: Record<string, number[]> = {};
  entries.forEach(e => {
    const day = e.created_at.slice(0, 10);
    if (!energyByDay[day]) energyByDay[day] = [];
    energyByDay[day].push(e.energy);
  });
  const energyTrend: EnergyTrend[] = Object.entries(energyByDay).map(([date, vals]) => ({
    date: date.slice(5),
    avg_energy: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
  })).slice(-30);

  // --- 時間帯分布（JST）---
  const hourCounts: Record<number, number> = {};
  entries.forEach(e => {
    const { hour } = jstParts(e.created_at);
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const hourDist: HourDist[] = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}`,
    count: hourCounts[h] || 0,
  }));

  // --- 曜日分布（月始まり・JST）---
  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const dayCounts: Record<number, number> = {};
  entries.forEach(e => {
    const { day } = jstParts(e.created_at);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const weekDayDist: WeekDayDist[] = [1, 2, 3, 4, 5, 6, 0].map(i => ({
    day: DAYS[i],
    count: dayCounts[i] || 0,
  }));

  // --- テキスト文字数分布 ---
  const contentLenDist: ContentLenDist[] = [
    { range: "〜50字",    count: entries.filter(e => e.content.length <= 50).length },
    { range: "51〜150字", count: entries.filter(e => e.content.length > 50 && e.content.length <= 150).length },
    { range: "151〜300字",count: entries.filter(e => e.content.length > 150 && e.content.length <= 300).length },
    { range: "301字〜",   count: entries.filter(e => e.content.length > 300).length },
  ];

  // --- 感情×平均エネルギー ---
  const eeMap: Record<string, number[]> = {};
  entries.forEach(e => {
    if (!e.dominant) return;
    if (!eeMap[e.dominant]) eeMap[e.dominant] = [];
    eeMap[e.dominant].push(e.energy);
  });
  const emotionEnergy: EmotionEnergy[] = Object.entries(eeMap).map(([emotion, vals]) => ({
    emotion,
    avg_energy: Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10,
    count: vals.length,
  })).sort((a, b) => b.avg_energy - a.avg_energy);

  // --- チャーン分析 ---
  // Server Component（リクエスト毎に1回実行）のため Date.now() は適切。
  // react-hooks/purity はクライアントのレンダー前提の誤検知。
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const churnDefs = [
    { range: "今日",    color: "#6ee7b7", test: (d: number) => d < 1 },
    { range: "2〜7日",  color: "#fde68a", test: (d: number) => d >= 1 && d <= 7 },
    { range: "8〜30日", color: "#f0a84e", test: (d: number) => d > 7 && d <= 30 },
    { range: "30日超",  color: "#c49494", test: (d: number) => isFinite(d) && d > 30 },
    { range: "未記録",  color: "#b5afa8", test: (d: number) => !isFinite(d) },
  ];
  const churnBuckets: ChurnBucket[] = churnDefs.map(d => ({ range: d.range, color: d.color, count: 0 }));
  users.forEach(u => {
    const days = u.last_entry_at
      ? (now - new Date(u.last_entry_at).getTime()) / 86400000
      : Infinity;
    const idx = churnDefs.findIndex(d => d.test(days));
    if (idx >= 0) churnBuckets[idx].count++;
  });

  // --- リテンション率（登録後N日以降も記録したか）---
  const userMaxEntry: Record<string, string> = {};
  entries.forEach(e => {
    if (!userMaxEntry[e.user_id] || e.created_at > userMaxEntry[e.user_id]) {
      userMaxEntry[e.user_id] = e.created_at;
    }
  });
  const retention: RetentionData[] = [
    { label: "Day 1",  sublabel: "翌日以降も記録", days: 1 },
    { label: "Day 7",  sublabel: "1週間後も記録",  days: 7 },
    { label: "Day 30", sublabel: "1ヶ月後も記録",  days: 30 },
  ].map(({ label, sublabel, days }) => {
    const count = users.filter(u => {
      const last = userMaxEntry[u.user_id];
      if (!last) return false;
      const diff = (new Date(last).getTime() - new Date(u.registered_at).getTime()) / 86400000;
      return diff >= days;
    }).length;
    return {
      label, sublabel, count,
      total: users.length,
      rate: users.length > 0 ? Math.round((count / users.length) * 100) : 0,
    };
  });

  // --- サマリー ---
  const totalEntries = users.reduce((s, u) => s + Number(u.total_entries), 0);
  const activeUsers = users.filter(u => {
    if (!u.last_entry_at) return false;
    return (now - new Date(u.last_entry_at).getTime()) / 86400000 <= 7;
  }).length;

  const data: AdminDashboardData = {
    users, emotions, energyTrend, hourDist, weekDayDist,
    contentLenDist, emotionEnergy, churnBuckets, retention,
    summary: {
      totalUsers: users.length,
      activeUsers,
      totalEntries,
      avgPerUser: users.length ? (totalEntries / users.length).toFixed(1) : "0",
    },
  };

  return <AdminDashboardClient data={data} />;
}
