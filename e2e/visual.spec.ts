import { expect, test } from "@playwright/test";

// ビジュアル回帰テスト（VRT）
// ------------------------------------------------------------------
// 目的: 「純粋ツリー抽出＝見た目不変」を機械で保証する。UI の意図しない
//       レイアウト・配色崩れ（回帰）をピクセル比較で検出する。
//
// 対象: 未認証で到達でき、描画が決定的な公開プロダクト面のみ。
//       - /auth/login   ログイン画面
//       - /auth/signup  登録画面
//       - /try          お試し体験（入力前の空状態／凪の応答後）
//       各面を「デスクトップ(1280x800)」と「モバイル(390x844)」の2ビューポートで撮る。
//       ※ /preview のコンポーネント gallery（EntryCard 等）は認証 or
//         /preview 公開化（middleware 変更＝FF-5 該当）が必要なため未対応（別 PR）。
//
// ベースライン画像は Linux(arm64) 環境でのみ生成・比較する。CI も arm64 ランナー
// （ubuntu-24.04-arm、公開リポジトリは無料の想定＝要確認）＋同じ Playwright イメージで実行し、
// arch とフォント描画を一致させる。macOS 等ローカルでは描画が CI と異なり必ず
// 不一致になるためスキップし、既存の `npm run test:e2e` ローカルフローを壊さない。
//
// ベースライン更新（リポジトリルートで実行。Docker/Colima 必要・無料）:
//   bash scripts/vrt-update-baselines.sh
// ------------------------------------------------------------------

// Linux 以外（開発者のローカル mac 等）ではスキップ。CI(ubuntu) と Docker(linux)
// でのみ実行する。
test.skip(
  process.platform !== "linux",
  "VRT は Linux ベースライン専用（CI/Docker で実行）。ローカル mac 等ではスキップ。",
);

// テーマ（app/components/ThemeManager.tsx）は new Date() の「時」と「月」で
// <html> に .dark / .time-* / .season-* を付与し、globals.css の CSS 変数を
// 全面的に上書きする（配色がライト↔ダーク・時間帯・季節で変わる）。CI は任意の
// UTC 時刻で走るため、時刻を固定してテーマを凍結しないと夜間ジョブでダーク反転し
// VRT が確実に落ちる。setFixedTime は goto 前（beforeEach）に設定し、ThemeManager の
// 初回 applyTheme（useEffect）と 60 秒ごとの再適用の両方を固定値に縛る。
//   2026-06-15T12:00:00Z = 12時（time-day・昼＝light）/ 6月（season-summer）
const FIXED_TIME = new Date("2026-06-15T12:00:00Z");

// モバイルビューポート（iPhone 相当の幅）。モバイル初回ログインの上部見切れ（v1.57 で
// 修正した既存バグ）等、モバイル固有の回帰を検出するために追加。
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// フォント（明朝 woff2 等）の読み込み完了を待ち、テキスト計測のブレを防ぐ。
async function waitForFontsReady(page: import("@playwright/test").Page) {
  await page.evaluate(() => document.fonts.ready);
}

const MOCK_DEMO_RESPONSE = {
  comment:
    "今日のことばを受け取りました。穏やかさの奥に、静かな希望が在るようです。",
  emotions: [
    { label: "穏やか", score: 0.7 },
    { label: "希望", score: 0.3 },
  ],
  dominant: "穏やか",
  energy: 6,
  insightLevel: "moderate",
};

type Page = import("@playwright/test").Page;

// 単純な公開ページ（入力前）の全画面スナップショット。
async function shotStaticPage(
  page: Page,
  url: string,
  snapshotName: string,
  waitForLabel?: string,
) {
  await page.goto(url);
  await waitForFontsReady(page);
  if (waitForLabel) await expect(page.getByLabel(waitForLabel)).toBeVisible();
  await expect(page).toHaveScreenshot(`${snapshotName}.png`, { fullPage: true });
}

// /try で凪の応答後のカード（EntryCard）を撮る。応答は API モックで確定化し、
// 生成時刻の <time> はマスクする（他要素＝感情チップ・エネルギー・コメントは通常比較）。
async function shotTryResponded(page: Page, snapshotName: string) {
  await page.route("**/api/comment/demo", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_DEMO_RESPONSE),
    });
  });

  await page.goto("/try");
  await waitForFontsReady(page);
  await page.getByLabel("今日の記録").fill("おだやかな一日だった");
  await page.getByRole("button", { name: "記録する" }).click();

  // 凪の応答（コメント）の描画完了を待つ。応答カード（EntryCard）は入力前ページに
  // 無かった明朝体を新規に要求するため、描画後にもう一度フォント待ちする（AA 差抑制）。
  await expect(page.getByText(MOCK_DEMO_RESPONSE.comment)).toBeVisible();
  await waitForFontsReady(page);
  await expect(page).toHaveScreenshot(`${snapshotName}.png`, {
    fullPage: true,
    mask: [page.locator("time")],
  });
}

// 全 VRT で時刻を固定してテーマ（ThemeManager）を凍結する。goto より前に設定する
// 必要があるため beforeEach で行う。
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_TIME);
});

// デスクトップ（config の viewport 1280x800）。スナップショット名は従来どおり（arch 一致の
// 既存ベースラインをそのまま使う）。
test.describe("ビジュアル回帰（デスクトップ）", () => {
  test("ログイン画面", async ({ page }) => {
    await shotStaticPage(page, "/auth/login", "auth-login");
  });
  test("登録画面", async ({ page }) => {
    await shotStaticPage(page, "/auth/signup", "auth-signup");
  });
  test("お試し体験・入力前", async ({ page }) => {
    await shotStaticPage(page, "/try", "try-empty", "今日の記録");
  });
  test("お試し体験・凪の応答後", async ({ page }) => {
    await shotTryResponded(page, "try-responded");
  });
});

// モバイル（390x844）。スナップショット名に -mobile を付け、デスクトップと別ベースラインにする。
test.describe("ビジュアル回帰（モバイル 390x844）", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("ログイン画面", async ({ page }) => {
    await shotStaticPage(page, "/auth/login", "auth-login-mobile");
  });
  test("登録画面", async ({ page }) => {
    await shotStaticPage(page, "/auth/signup", "auth-signup-mobile");
  });
  test("お試し体験・入力前", async ({ page }) => {
    await shotStaticPage(page, "/try", "try-empty-mobile", "今日の記録");
  });
  test("お試し体験・凪の応答後", async ({ page }) => {
    await shotTryResponded(page, "try-responded-mobile");
  });
});
