"use client";

import { useEffect } from "react";
import { estimateLocation, getSunTimes, getTimePhase } from "@/lib/solar";

// 時刻・季節に基づくテーマ切替（v1.41 → v1.86.0 で時刻の基準を太陽に変更）
//
// 時刻4区分は**実際の夜明け・日没**に追従する（lib/solar.ts）:
//   夜 = 薄明の外側（夜明け前・日没後）／朝 = 夜明け〜日の出+2.5h
//   夕 = 日の入り-1.5h〜薄明の終わり／昼 = その間
// 位置はタイムゾーンから推定する（位置情報の許可ダイアログを出さない・通信もしない）。
// 緯度は IANA ゾーン名の代表都市表、経度は**標準時**オフセット（夏時間を除く）から求める。
// 極夜・白夜など太陽から決められない場合は固定時刻（朝06–10…）へフォールバックする。
//
// 季節4種: 春3–5 / 夏6–8 / 秋9–11 / 冬12–2（v1.41 から変更なし）
export default function ThemeManager() {
  useEffect(() => {
    const TIME_CLASSES = ["time-morning", "time-day", "time-evening", "time-night"] as const;
    const SEASON_CLASSES = ["season-spring", "season-summer", "season-autumn", "season-winter"] as const;

    const applyTheme = () => {
      const now = new Date();
      const m = now.getMonth() + 1;
      const root = document.documentElement;

      // 位置はタイムゾーンから推定する（緯度は代表都市の表・経度は標準時オフセット）
      const { latitude, longitude } = estimateLocation(now);
      const sun = getSunTimes(now, latitude, longitude);
      const phase = getTimePhase(now, sun);

      root.classList.toggle("dark", phase === "night");

      TIME_CLASSES.forEach(c => root.classList.remove(c));
      root.classList.add(`time-${phase}`);

      const seasonClass =
        m >= 3 && m <= 5  ? "season-spring" :
        m >= 6 && m <= 8  ? "season-summer" :
        m >= 9 && m <= 11 ? "season-autumn" :
                            "season-winter";
      SEASON_CLASSES.forEach(c => root.classList.remove(c));
      root.classList.add(seasonClass);
    };

    applyTheme();
    const timer = setInterval(applyTheme, 60_000);
    return () => clearInterval(timer);
  }, []);

  return null;
}
