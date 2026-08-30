import { expect, test } from "@playwright/test";
import { APP_SUBTITLE, ABOUT_INTRO, PRIVACY_ASSURANCE } from "../app/lib/about";

// 公開面の文言の回帰防止（v1.88.0）
// ------------------------------------------------------------------
// VRT（e2e/visual.spec.ts）は maxDiffPixelRatio: 0.01（1%）で回しているため、
// 短い文言の差し替えを検出しない（harness.md CC-9.1）。文言そのものの担保は
// この e2e が持つ。両方そろって初めて「見た目」と「ことば」の回帰が防げる。

const MOCK_DEMO_RESPONSE = {
  comment: "今日のことばを受け取りました。穏やかさの奥に、静かな希望が在るようです。",
  emotions: [{ label: "穏やか", score: 0.7 }],
  dominant: "穏やか",
  energy: 6,
  insightLevel: "moderate",
};

// サブタイトルは app/lib/about.ts の APP_SUBTITLE 1箇所に集約されている（v1.88.0）。
// 各ページへの直書きに逆戻りすると、ここが片側だけ変わって落ちる。
test.describe("サブタイトルの共通化", () => {
  const PAGES = [
    { name: "ログイン画面", path: "/auth/login" },
    { name: "登録画面", path: "/auth/signup" },
    { name: "パスワード再設定（申請）", path: "/auth/forgot-password" },
    { name: "お試し体験", path: "/try" },
  ];

  for (const { name, path } of PAGES) {
    test(`${name}に「${APP_SUBTITLE}」が表示される`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(APP_SUBTITLE, { exact: true })).toBeVisible();
    });
  }
});

test.describe("プライバシーの明示（v1.88.0）", () => {
  test("登録画面に「誰にも見えない」旨が表示される", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByText(PRIVACY_ASSURANCE, { exact: true })).toBeVisible();
  });

  test("お試し体験の応答後、登録CTAに「誰にも見えない」旨が表示される", async ({ page }) => {
    await page.route("**/api/comment/demo", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DEMO_RESPONSE),
      });
    });

    await page.goto("/try");
    // 応答前は登録CTAごと存在しない
    await expect(page.getByText(PRIVACY_ASSURANCE, { exact: true })).toHaveCount(0);

    await page.getByLabel("今日の記録").fill("おだやかな一日だった");
    await page.getByRole("button", { name: "記録する" }).click();

    await expect(page.getByText(PRIVACY_ASSURANCE, { exact: true })).toBeVisible();
  });
});

// 「書きたいときだけ、開いてください。」＝催促しないという約束（仕様書 1.2）。
// 将来プッシュ通知を入れる場合も、この一文と矛盾しない設計（＝催促ではなく贈りもの）に保つ。
test.describe("凪の紹介文", () => {
  test("お試し体験に紹介文が表示され、開くタイミングを委ねる一文を含む", async ({ page }) => {
    await page.goto("/try");
    await expect(page.getByText(ABOUT_INTRO, { exact: true })).toBeVisible();
    expect(ABOUT_INTRO).toContain("書きたいときだけ、開いてください。");
  });
});
