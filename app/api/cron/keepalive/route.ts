import { NextResponse, type NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Vercel Cron（日次）から GET される Supabase keepalive エンドポイント。
// Supabase 無料プランは「DB アクティビティ」が7日途切れると一時停止される。
// anon key で REST に select limit 1 を投げ、Postgres 上でクエリを実行させる
// （RLS で結果は空だがクエリ自体は走る＝DB アクティビティ）。日次で7日しきい値に対し十分な余裕。
//
// セキュリティ: publicPaths で認証 middleware を素通りするため、このルート自身が境界。
// CRON_SECRET を設定すると Vercel が Authorization: Bearer <CRON_SECRET> を自動付与する。
// 未設定 or 不一致は 401（公式推奨パターン）。service role は使わず anon key に留める。
// force-dynamic で静的化させず必ず関数を実行する。
export const dynamic = "force-dynamic";

// Sentry Cron Monitoring（dead-man's-switch）。
// keepalive が成功したときだけ ok check-in を送る。cron 不発・CRON_SECRET 不一致（401）・
// Supabase 到達失敗のいずれでも ok が届かず、Sentry が定刻超過で "missed" として通知する。
// monitorConfig を渡すことで monitor をコードから upsert（ダッシュボードでの手動作成が不要）。
const MONITOR_SLUG = "supabase-keepalive";
const MONITOR_CONFIG = {
  schedule: { type: "crontab", value: "0 15 * * *" },
  checkinMargin: 60, // Hobby cron は「時」内でドリフトするため遅延を許容（分）
  maxRuntime: 5,
  timezone: "Etc/UTC",
} as const;

async function reportCheckIn(ok: boolean) {
  try {
    Sentry.captureCheckIn(
      { monitorSlug: MONITOR_SLUG, status: ok ? "ok" : "error" },
      MONITOR_CONFIG
    );
    // serverless では関数凍結前に送信を保証する
    await Sentry.flush(2000);
  } catch {
    // 監視 check-in の失敗は keepalive 本処理に影響させない
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    // 秘密情報は出さず、事実のみ返す
    return NextResponse.json(
      { ok: false, error: "Supabase env not configured" },
      { status: 500 }
    );
  }

  try {
    // cron はリトライしないため例外は握って status を返す（日次×7日余裕で許容）
    const res = await fetch(
      `${supabaseUrl}/rest/v1/entries?select=id&limit=1`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        cache: "no-store",
      }
    );
    await reportCheckIn(res.ok);
    return NextResponse.json({ ok: res.ok, supabase: res.status });
  } catch {
    await reportCheckIn(false);
    return NextResponse.json(
      { ok: false, error: "Supabase request failed" },
      { status: 500 }
    );
  }
}
