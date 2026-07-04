import { expect, test } from "@playwright/test";

// ビジュアル回帰テスト（VRT）
// ------------------------------------------------------------------
// 目的: 「純粋ツリー抽出＝見た目不変」を機械で保証する。UI の意図しない
//       レイアウト・配色崩れ（回帰）をピクセル比較で検出する。
//
// 対象: 未認証で到達でき、描画が決定的な公開プロダクト面のみ（v1）。
//       - /auth/login   ログイン画面
//       - /auth/signup  登録画面
//       - /try          お試し体験（入力前の空状態／凪の応答後）
//       ※ /preview のコンポーネント gallery（EntryCard 等）は認証 or
//         /preview 公開化（middleware 変更＝FF-5 該当）が必要なため v2 で対応。
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

// 全 VRT で時刻を固定してテーマ（ThemeManager）を凍結する。goto より前に設定する
// 必要があるため beforeEach で行う。
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_TIME);
});

test.describe("ビジュアル回帰（公開ページ）", () => {
  test("ログイン画面", async ({ page }) => {
    await page.goto("/auth/login");
    await waitForFontsReady(page);
    await expect(page).toHaveScreenshot("auth-login.png", { fullPage: true });
  });

  test("登録画面", async ({ page }) => {
    await page.goto("/auth/signup");
    await waitForFontsReady(page);
    await expect(page).toHaveScreenshot("auth-signup.png", { fullPage: true });
  });

  test("お試し体験・入力前", async ({ page }) => {
    await page.goto("/try");
    await waitForFontsReady(page);
    // 入力欄の描画完了を待つ
    await expect(page.getByLabel("今日の記録")).toBeVisible();
    await expect(page).toHaveScreenshot("try-empty.png", { fullPage: true });
  });

  test("お試し体験・凪の応答後", async ({ page }) => {
    // 応答は API モックで確定化（実 Anthropic API は呼ばない）
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

    // 凪の応答（コメント）の描画完了を待ってから撮影
    await expect(page.getByText(MOCK_DEMO_RESPONSE.comment)).toBeVisible();
    // 応答カード（EntryCard）は入力前ページに無かった明朝体を新規に要求するため、
    // 応答描画後にもう一度フォント読み込み完了を待つ（AA 差の抑制）。
    await waitForFontsReady(page);
    // 応答カードの <time>（生成時刻 = Date.now 由来）は非決定的なのでマスクする。
    // マスク領域以外（感情チップ・エネルギー・コメント本文等）は通常どおり比較される。
    await expect(page).toHaveScreenshot("try-responded.png", {
      fullPage: true,
      mask: [page.locator("time")],
    });
  });
});
