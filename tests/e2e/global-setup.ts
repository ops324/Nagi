import { execSync } from "node:child_process";

/**
 * テスト全体の前に supabase db reset を 1 回実行し、
 * マイグレーション + seed を再適用してクリーンな状態に戻す。
 *
 * 失敗時（Supabase が起動していない等）はわかりやすいメッセージで abort。
 */
export default async function globalSetup() {
  console.log("[global-setup] supabase db reset を実行します（10〜20秒ほどかかります）...");

  try {
    execSync("supabase db reset --no-seed=false", {
      stdio: "pipe",
      cwd: process.cwd(),
      timeout: 60_000,
    });
    console.log("[global-setup] DB をシード状態にリセットしました。");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[global-setup] supabase db reset に失敗しました:", message);
    console.error("[global-setup] ローカル Supabase が起動しているか確認してください: npm run db:start");
    throw err;
  }
}
