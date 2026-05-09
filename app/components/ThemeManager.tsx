"use client";

import { useEffect } from "react";

// 時刻・季節に基づくテーマ切替（v1.41）
// 時刻4区分: 朝06–10 / 昼10–17 / 夕17–19 / 夜19–06
// 季節4種: 春3–5 / 夏6–8 / 秋9–11 / 冬12–2
export default function ThemeManager() {
  useEffect(() => {
    const TIME_CLASSES = ["time-morning", "time-day", "time-evening", "time-night"] as const;
    const SEASON_CLASSES = ["season-spring", "season-summer", "season-autumn", "season-winter"] as const;

    const applyTheme = () => {
      const now = new Date();
      const h = now.getHours();
      const m = now.getMonth() + 1;
      const root = document.documentElement;

      const isNight = h >= 19 || h < 6;
      root.classList.toggle("dark", isNight);

      const timeClass =
        h >= 6 && h < 10  ? "time-morning" :
        h >= 10 && h < 17 ? "time-day"     :
        h >= 17 && h < 19 ? "time-evening" :
                            "time-night";
      TIME_CLASSES.forEach(c => root.classList.remove(c));
      root.classList.add(timeClass);

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
