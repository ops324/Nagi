// Next.js Instrumentation。ランタイムに応じて Sentry のサーバ/エッジ初期化を読み込み、
// サーバー側エラーを onRequestError で捕捉する。
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
