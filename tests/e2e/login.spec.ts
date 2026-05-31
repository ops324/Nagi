import { test, expect } from "@playwright/test";

/**
 * 検証 #1: dev@nagi.local でログインしてサンプル記録 3 件が表示される
 */
test("dev ユーザーでログインしてサンプル記録 3 件が表示される", async ({ page }) => {
  await page.goto("/auth/login");

  // DEV_AUTOFILL が効いていても上書きして明示的に入力
  await page.locator("#login-email").fill("dev@nagi.local");
  await page.locator("#login-password").fill("nagidev");

  await Promise.all([
    page.waitForURL("**/", { timeout: 15_000 }),
    page.getByRole("button", { name: "ログイン" }).click(),
  ]);

  // ホームに遷移したことを確認
  expect(new URL(page.url()).pathname).toBe("/");

  // サンプル entry の本文（seed.sql の3件）が表示されている
  await expect(page.getByText("今日は風が涼しくて、散歩中に少しだけ心がほどけた気がする。")).toBeVisible();
  await expect(page.getByText("仕事で集中しきれず、夕方になって少し疲れを感じた。")).toBeVisible();
  await expect(page.getByText("友人と話していて、自分のなかに小さな期待が動いていることに気づいた。")).toBeVisible();
});
