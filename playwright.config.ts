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
    // VRT の決定性のためビューポートを固定（既定 Desktop Chrome は 1280x720）。
    viewport: { width: 1280, height: 800 },
  },
  // ビジュアル回帰テスト（visual.spec.ts）の既定。
  // - animations: CSS アニメ／トランジションを凍結（globals.css の無限アニメ対策）
  // - maxDiffPixelRatio: OS/エミュレーション差によるアンチエイリアスの微差を吸収しつつ
  //   レイアウト・配色の実リグレッションは検出できる範囲（1%）に設定
  // ベースライン画像は Linux(arm64) でのみ生成・比較する（visual.spec.ts のガード参照）。
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
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
