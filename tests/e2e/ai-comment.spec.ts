import { test, expect } from "@playwright/test";

/**
 * 検証 #2: 新規記録投稿で凪のコメントが生成される（Anthropic API 連携）
 *
 * ANTHROPIC_API_KEY が必要なので消費を避けたい場合は SKIP_AI=1 を設定すれば skip。
 * dev で .env.local の ANTHROPIC_API_KEY が自動継承される（.env.development.local が上書きしない）。
 */
const skipAI = process.env.SKIP_AI === "1";

test.describe("AI コメント生成", () => {
  test.skip(skipAI, "SKIP_AI=1 のためスキップします（Anthropic API 消費回避）");

  test("記録を投稿すると凪のコメントが生成されカードに表示される", async ({ page }) => {
    test.setTimeout(90_000); // Anthropic API 呼び出し含むため長め

    // /api/comment への POST が 200 で返ることを net assertion でも確認
    const commentResponse = page.waitForResponse(
      (r) => r.url().includes("/api/comment") && r.request().method() === "POST",
      { timeout: 60_000 }
    );

    // ログイン
    await page.goto("/auth/login");
    await page.locator("#login-email").fill("dev@nagi.local");
    await page.locator("#login-password").fill("nagidev");
    await Promise.all([
      page.waitForURL("**/", { timeout: 15_000 }),
      page.getByRole("button", { name: "ログイン" }).click(),
    ]);

    // 記録を入力（タイムスタンプ付きユニーク文字列）
    const stamp = Date.now();
    const uniqueContent = `e2e-${stamp} 今日はテスト中の小さな緊張と、進んでいる手応えが同居している。`;
    const textarea = page.getByRole("textbox", { name: "今日の記録" });
    await textarea.fill(uniqueContent);

    // 「記録する」ボタン
    const submitBtn = page.getByRole("button", { name: "記録する" });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // /api/comment のレスポンスが 200 OK
    const resp = await commentResponse;
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(typeof body.comment).toBe("string");
    expect(body.comment.length).toBeGreaterThan(5);
    expect(Array.isArray(body.emotions)).toBe(true);
    expect(typeof body.energy).toBe("number");

    // 投稿後、textarea は空になる（入力欄ではなく一覧側に表示される）
    await expect(textarea).toHaveValue("", { timeout: 10_000 });

    // 投稿された本文が記録一覧に表示される
    // <p> タグでレンダリングされるので article/section スコープを優先
    await expect(page.locator(`text=${uniqueContent}`).first()).toBeVisible({ timeout: 10_000 });

    // API が返したコメント文の冒頭 10 文字がページに存在する（凪のことばが描画されている）
    const commentExcerpt = body.comment.slice(0, 10);
    await expect(page.locator(`text=${commentExcerpt}`).first()).toBeVisible({ timeout: 10_000 });
  });
});
