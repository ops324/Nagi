import { defineConfig, devices } from "@playwright/test";

/**
 * Nagi ローカル E2E テスト設定
 *
 * 前提:
 *  - ローカル Supabase が起動済み（`npm run db:start`）
 *  - .env.development.local が設定済み
 *  - ANTHROPIC_API_KEY が .env.local に存在
 *
 * テスト実行前に supabase db reset でシード状態に戻す（globalSetup）。
 * dev サーバーは Playwright が自動起動する。
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // 同じ DB を共有するためシリアル実行
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",

  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // ポート 3100 を使用（3000 は Claude Desktop が使用中のことがあるため衝突回避）
  // 親シェルに ANTHROPIC_API_KEY 等が設定されていると .env.local の値を shadow するため、
  // sh -c で明示的に unset してから next dev を起動する（.env.local が真の唯一の出典になる）
  webServer: {
    command: "sh -c 'unset ANTHROPIC_API_KEY NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_DEV_AUTOFILL; exec npx next dev -p 3100'",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
