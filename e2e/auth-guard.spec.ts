import { expect, test } from "@playwright/test";

// 認証ガード（proxy.ts / middleware）の動作確認。
// ログインは行わず、未認証アクセスのリダイレクトのみを検証する。

test.describe("認証ガード", () => {
  test("未認証でメインページにアクセスすると /auth/login へリダイレクト", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("未認証でアカウント設定にアクセスすると /auth/login へリダイレクト", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("公開ページ /try は未認証でも表示できる", async ({ page }) => {
    await page.goto("/try");
    await expect(page).toHaveURL(/\/try/);
    await expect(page.getByLabel("今日の記録")).toBeVisible();
  });
});
