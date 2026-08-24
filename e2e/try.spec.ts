import { expect, test } from "@playwright/test";

// /try（未登録のお試し体験）。/api/comment/demo をモックして確定的に検証する。
// 実 Anthropic API は呼ばない（コスト・揺れ防止）。

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

test.describe("/try お試し体験", () => {
  test("入力前は注記と入力欄が表示される", async ({ page }) => {
    await page.goto("/try");
    await expect(page.getByLabel("今日の記録")).toBeVisible();
    await expect(page.getByText("ここで書いたことばは保存されません", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "記録する" })).toBeVisible();
  });

  test("記録すると凪の応答と登録CTAが表示される", async ({ page }) => {
    // API をモック（確定的なレスポンス）
    await page.route("**/api/comment/demo", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DEMO_RESPONSE),
      });
    });

    await page.goto("/try");
    await page.getByLabel("今日の記録").fill("おだやかな一日だった");
    await page.getByRole("button", { name: "記録する" }).click();

    // 凪の応答（コメント）が表示される
    await expect(page.getByText(MOCK_DEMO_RESPONSE.comment)).toBeVisible();

    // 登録CTA（/auth/signup への導線）
    const cta = page.getByRole("link", { name: "はじめる" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/auth/signup");

    // 保存されない旨の注記
    await expect(page.getByText("いま書いたことばは保存されていません", { exact: false })).toBeVisible();

    // 入力欄は応答後に消える
    await expect(page.getByLabel("今日の記録")).toHaveCount(0);
  });

  test("API エラー時はエラーメッセージを表示し、応答は出さない", async ({ page }) => {
    await page.route("**/api/comment/demo", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "リクエストが多すぎます" }),
      });
    });

    await page.goto("/try");
    await page.getByLabel("今日の記録").fill("テスト入力");
    await page.getByRole("button", { name: "記録する" }).click();

    await expect(page.getByText("リクエストが多すぎます")).toBeVisible();
    // 入力欄は残る（応答に遷移していない）
    await expect(page.getByLabel("今日の記録")).toBeVisible();
  });
});

// お試し体験への「入口」の回帰防止（v1.85.0）
// ------------------------------------------------------------------
// 新規ユーザーが最初に着く画面（未認証は proxy.ts で /auth/login にリダイレクト）
// から、お試し体験へボタンとして到達できることを固定する。
// 12px のテキストリンク1本に戻る／文言変更やリンク切れで導線が失われる、を検出する。
const TRY_ENTRY_LABEL = "登録のまえに、凪をお試し";

test.describe("お試し体験への導線", () => {
  const ENTRY_POINTS = [
    { name: "ログイン画面", path: "/auth/login" },
    { name: "登録画面", path: "/auth/signup" },
  ];

  for (const { name, path } of ENTRY_POINTS) {
    test(`${name}からお試し体験に入れる`, async ({ page }) => {
      await page.goto(path);

      const entry = page.getByRole("link", { name: TRY_ENTRY_LABEL });
      await expect(entry).toBeVisible();
      await expect(entry).toHaveAttribute("href", "/try");

      // ボタンとしての最低限のタップ領域（12px テキストリンクへの逆戻り検出）。
      // 実測は 42px（py-3 の 24 ＋ text-xs の行高 16 ＋ 上下ボーダー 2）。
      // 閾値は 36px＝テキストリンク（約 16〜19px）とは十分に離れ、かつ将来の
      // 行高・余白の微調整で誤検知しない位置に置く。
      const box = await entry.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);

      await entry.click();
      await expect(page).toHaveURL(/\/try/);
      await expect(page.getByLabel("今日の記録")).toBeVisible();
    });
  }
});
