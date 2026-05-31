import { test, expect } from "@playwright/test";

/**
 * 検証 #3: admin@nagi.local でログインして /admin ダッシュボードにアクセスできる
 */
test("admin ユーザーで /admin ダッシュボードを表示できる", async ({ page }) => {
  // admin でログイン
  await page.goto("/auth/login");
  await page.locator("#login-email").fill("admin@nagi.local");
  await page.locator("#login-password").fill("nagiadmin");
  await Promise.all([
    page.waitForURL("**/", { timeout: 15_000 }),
    page.getByRole("button", { name: "ログイン" }).click(),
  ]);

  // /admin へ遷移（一般ユーザーなら / にリダイレクトされる）
  await page.goto("/admin");

  // URL が /admin のままであることを確認（リダイレクトされていない）
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).pathname).toBe("/admin");

  // ダッシュボード見出しが表示される
  await expect(page.getByRole("heading", { name: "管理者ダッシュボード" })).toBeVisible();
});
