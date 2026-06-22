"use client";

// ルート全体が壊れた際のフォールバック。エラーを Sentry に報告し、
// 凪のトーンで静かな再読み込み導線を出す。global-error は自前で html/body を持つ。
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "2rem",
          backgroundColor: "#f7f5f0",
          color: "#44403c",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: "0.95rem", lineHeight: 1.9, color: "#78716c" }}>
          少しの間、つながりが途切れたようです。
          <br />
          もう一度、ゆっくり開いてみてください。
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: "0.75rem 2.5rem",
            borderRadius: "9999px",
            border: "none",
            backgroundColor: "#6ee7b7",
            color: "#065f46",
            fontSize: "0.8rem",
            letterSpacing: "0.1em",
            cursor: "pointer",
          }}
        >
          もう一度
        </button>
      </body>
    </html>
  );
}
