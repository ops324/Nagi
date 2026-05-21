// 管理者ダッシュボードの集計データ型（サーバー集計 → クライアント描画で共有）

export type UserRow = {
  user_id: string;
  email: string;
  registered_at: string;
  total_entries: number;
  last_entry_at: string | null;
  avg_energy: number | null;
};

export type EmotionRow = { emotion_label: string; count: number };
export type EnergyTrend = { date: string; avg_energy: number };
export type HourDist = { hour: string; count: number };
export type WeekDayDist = { day: string; count: number };
export type ContentLenDist = { range: string; count: number };
export type EmotionEnergy = { emotion: string; avg_energy: number; count: number };
export type ChurnBucket = { range: string; count: number; color: string };
export type RetentionData = { label: string; sublabel: string; rate: number; count: number; total: number };

export type AdminSummary = {
  totalUsers: number;
  activeUsers: number;
  totalEntries: number;
  avgPerUser: string;
};

export type AdminDashboardData = {
  users: UserRow[];
  emotions: EmotionRow[];
  energyTrend: EnergyTrend[];
  hourDist: HourDist[];
  weekDayDist: WeekDayDist[];
  contentLenDist: ContentLenDist[];
  emotionEnergy: EmotionEnergy[];
  churnBuckets: ChurnBucket[];
  retention: RetentionData[];
  summary: AdminSummary;
};
