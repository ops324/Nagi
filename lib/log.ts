// 共通エラーロギング。
// - 開発: 詳細を console.error
// - 本番: Sentry へ captureException（DSN 未設定なら no-op）＋ 簡潔な console.error
//
// 重要（プライバシー）: 日記本文などのユーザー入力は引数に渡さないこと。
// context は route 名など非機微なラベルのみを想定。
import * as Sentry from "@sentry/nextjs";

export function logError(
  error: unknown,
  context?: { scope?: string; extra?: Record<string, string | number | boolean> }
): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context?.scope ?? "app"}]`, error, context?.extra ?? "");
    return;
  }

  // 本番: 詳細はクライアントに返さず Sentry にのみ送る
  console.error(`[${context?.scope ?? "app"}] error captured`);
  Sentry.captureException(error, {
    tags: context?.scope ? { scope: context.scope } : undefined,
    extra: context?.extra,
  });
}
