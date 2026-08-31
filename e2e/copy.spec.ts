import { expect, test } from "@playwright/test";
import { APP_SUBTITLE, ABOUT_INTRO, PRIVACY_ASSURANCE } from "../app/lib/about";

// 公開面の文言の回帰防止（v1.88.0）
// ------------------------------------------------------------------
// VRT（e2e/visual.spec.ts）は maxDiffPixelRatio: 0.01（1%）で回しているため、
// 短い文言の差し替えを検出しない（harness.md CC-9.1）。文言そのものの担保はここが持つ。
//
// 二層構成にしている理由:
//   ① 定数（about.ts）を import した比較 … UI が定数を参照していること＝集約の回帰を検出する。
//      直書きに逆戻りすると落ちる。ただし**定数と UI が同時に変われば素通りする**。
//   ② リテラルのアンカー … 文言そのものを固定する。①だけでは文言の巻き戻しを検出できない
//      （定数を旧文言に戻すと①は全件 green のままになることを実測で確認済み）。
// 約束を担う文言（PRIVACY_ASSURANCE）と、ブランドの中核（APP_SUBTITLE）には必ず②を置く。

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
    // /auth/* は proxy.ts（lib/supabase/middleware.ts）で未認証でも素通りするため、
    // recovery トークンなしでも描画される＝ここで担保できる。
    { name: "パスワード再設定（新パスワード）", path: "/auth/reset-password" },
    { name: "お試し体験", path: "/try" },
  ];

  // ② リテラルのアンカー。定数ごと巻き戻す変更を検出する。
  test("サブタイトルの文言そのものが固定されている", () => {
    expect(APP_SUBTITLE).toBe("Nagi · 波が凪ぐところ");
  });

  for (const { name, path } of PAGES) {
    test(`${name}に「${APP_SUBTITLE}」が表示される`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(APP_SUBTITLE, { exact: true })).toBeVisible();
    });
  }
});

test.describe("プライバシーの明示（v1.88.0）", () => {
  // ② リテラルのアンカー。約束の範囲（「ほかの利用者」であって「誰にも」ではない）を固定する。
  // 強める方向へ変える場合は、管理者の is_admin() バイパスと Anthropic 送信を先に解消すること
  // （根拠は app/lib/about.ts の PRIVACY_ASSURANCE のコメント）。
  test("約束の文言そのものが固定されている", () => {
    expect(PRIVACY_ASSURANCE).toBe(
      "書いた記録は、あなただけのものです。ほかの利用者に見られることはありません。"
    );
  });

  test("登録画面に「ほかの利用者には見えない」旨が表示される", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByText(PRIVACY_ASSURANCE, { exact: true })).toBeVisible();
  });

  test("お試し体験の応答後、登録CTAに「ほかの利用者には見えない」旨が表示される", async ({ page }) => {
    await page.route("**/api/comment/demo", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DEMO_RESPONSE),
      });
    });

    await page.goto("/try");
    // 先に描画済みであることを確定させる（ページが出ていなくても toHaveCount(0) は通るため）
    await expect(page.getByLabel("今日の記録")).toBeVisible();
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

// 開示の回帰防止（v1.89.0）
// ------------------------------------------------------------------
// 運営者アクセスの開示は「書ける約束の範囲」を決める前提になっている
// （app/lib/about.ts の PRIVACY_ASSURANCE のコメント参照）。
// 節ごと消えても他のテストは落ちないため、ここで固定する。
test.describe("プライバシーポリシーの開示（v1.89.0）", () => {
  test("運営者によるデータの取り扱いが明記されている", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      // 節番号は前に節が挿入されるとずれる（本 PR 自体が 6→10 の繰り下げをしている）。
      // 守りたいのは「節が消えていないこと」なので、番号は含めず見出し名で照合する。
      page.getByRole("heading", { name: /運営者によるデータの取り扱い/ })
    ).toBeVisible();
    await expect(
      page.getByText("日記の本文が分析画面に表示されることはありません", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("記録の内容を参照できる状態にあります", { exact: false })
    ).toBeVisible();
    // 管理画面はメールアドレス一覧も表示する（AdminDashboardClient のユーザー一覧）。
    // 「統計情報のみ」と書くと過大な主張になるため、開示に含まれていることを固定する。
    await expect(
      page.getByText("登録済みメールアドレス", { exact: false })
    ).toBeVisible();
  });

  test("5章はほかの利用者からの不可視として書かれている（運営者を含む表現にしない）", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByText("ほかの利用者があなたの記録を読むことはできません", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("ユーザーは自分のデータのみにアクセスできます", { exact: false })
    ).toHaveCount(0);
  });
});
