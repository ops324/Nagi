import { defineConfig, devices } from "@playwright/test";

// 未認証で確定的に回せる E2E のみを対象とする（/try のお試し体験・認証ガードの
// リダイレクト）。認証が絡むフロー（投稿・削除）はテスト用アカウント／Secrets が
// 必要なため、別途対応する。
//
// webServer:
//   - ローカル: `npm run dev`（起動済みなら再利用）
//   - CI: 本番ビルド + start（オンデマンドコンパイルの揺れを避け確定的に）
// dev/start サーバは proxy.ts（middleware）が Supabase 環境変数を要求するため、
// CI ではダミー値をジョブ側 env で与える（実通信は /api/comment/demo をモックして回避）。
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
