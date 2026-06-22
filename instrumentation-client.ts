// Sentry 初期化（ブラウザ）。Next.js が自動で読み込む。
// DSN 未設定時は無効。日記本文はクライアントから Sentry へ送らない。
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
