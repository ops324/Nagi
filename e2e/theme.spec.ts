import { expect, test } from "@playwright/test";

// 太陽（夜明け・日没）に連動するテーマ切替の回帰テスト（v1.86.0）
// ------------------------------------------------------------------
// lib/solar.ts の計算そのものは単体テスト（lib/solar.test.ts）で担保する。
// ここでは「ThemeManager が実際に <html> のクラスを付け替える」という配線と、
// 固定時刻→期待するテーマ、の対応が壊れていないことをブラウザ上で固定する。
//
// 決定性の担保:
//   - timezoneId を Asia/Tokyo に固定（ページ内の getTimezoneOffset が常に -540 ＝
//     経度 135°E 相当になる。これがないと CI(UTC) と開発機(JST) で結果が変わる）
//   - page.clock.setFixedTime で時刻を固定（goto より前に設定する）
//
// 経度 135°E・緯度 35.7°N での各日の太陽（lib/solar.ts の計算値）:
//   2026-06-21  夜明 04:15 / 日の出 04:45 / 日の入り 19:20 / 薄明終わり 19:50
//   2026-12-21  夜明 06:38 / 日の出 07:06 / 日の入り 16:51 / 薄明終わり 17:19

test.use({ timezoneId: "Asia/Tokyo" });

type Case = {
  title: string;
  /** JST の固定時刻 */
  at: string;
  expectedTime: "time-morning" | "time-day" | "time-evening" | "time-night";
  expectedDark: boolean;
};

const CASES: Case[] = [
  {
    title: "夏至の未明（夜明け前）は夜",
    at: "2026-06-21T03:30:00+09:00",
    expectedTime: "time-night",
    expectedDark: true,
  },
  {
    title: "夏至の夜明け直後は朝（日の出より前でもライト）",
    at: "2026-06-21T04:30:00+09:00",
    expectedTime: "time-morning",
    expectedDark: false,
  },
  {
    title: "夏至の正午は昼",
    at: "2026-06-21T12:00:00+09:00",
    expectedTime: "time-day",
    expectedDark: false,
  },
  {
    title: "夏至の19時はまだ日が沈んでおらず夕（旧仕様では夜だった）",
    at: "2026-06-21T19:00:00+09:00",
    expectedTime: "time-evening",
    expectedDark: false,
  },
  {
    title: "夏至は薄明が終わる19:50以降に夜へ",
    at: "2026-06-21T20:00:00+09:00",
    expectedTime: "time-night",
    expectedDark: true,
  },
  {
    title: "冬至の17時半は日没後で夜（旧仕様では夕・ライトだった）",
    at: "2026-12-21T17:30:00+09:00",
    expectedTime: "time-night",
    expectedDark: true,
  },
  {
    title: "冬至の16時は日の入り前で夕",
    at: "2026-12-21T16:00:00+09:00",
    expectedTime: "time-evening",
    expectedDark: false,
  },
  {
    title: "冬至の6時半はまだ夜明け前で夜（旧仕様では朝・ライトだった）",
    at: "2026-12-21T06:30:00+09:00",
    expectedTime: "time-night",
    expectedDark: true,
  },
];

test.describe("テーマ（夜明け・日没連動）", () => {
  for (const c of CASES) {
    test(c.title, async ({ page }) => {
      await page.clock.setFixedTime(new Date(c.at));
      await page.goto("/try");

      const html = page.locator("html");
      await expect(html).toHaveClass(new RegExp(`\\b${c.expectedTime}\\b`));

      // 4区分は排他（他の time-* が残っていない）
      const classes = (await html.getAttribute("class")) ?? "";
      const timeClasses = classes.split(/\s+/).filter((x) => x.startsWith("time-"));
      expect(timeClasses).toEqual([c.expectedTime]);

      expect(classes.split(/\s+/).includes("dark")).toBe(c.expectedDark);
    });
  }
});
