// Sentry 初期化（Node.js サーバーランタイム）。instrumentation.ts から import される。
// DSN 未設定時は enabled:false で完全に無効（オーバーヘッド・警告なし）。
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  // 日記アプリのため PII（IP・リクエスト本文等）は送らない
  sendDefaultPii: false,
  // パフォーマンストレースは控えめ（本番はサンプリング、開発は全件）
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
