/**
 * Anthropic API 呼び出しのリトライ＋指数バックオフ
 *
 * 529(Overloaded) や 429・5xx などの一時的なエラーに対し、
 * 短いバックオフを挟んで数回再試行する。Vercel のサーバーレス実行時間を
 * 超えないよう、待機は控えめに設定している。
 */

import type Anthropic from "@anthropic-ai/sdk";

// 再試行する HTTP ステータス（一時的・回復見込みのあるもの）
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

/** 一時的（再試行する価値のある）エラーかどうか */
export function isRetryableError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  if (typeof status === "number") return RETRYABLE_STATUS.has(status);
  // ネットワーク系（status を持たない接続エラー）も再試行対象
  const name = (err as { name?: string } | null)?.name;
  return name === "APIConnectionError" || name === "APIConnectionTimeoutError";
}

/**
 * client.messages.create をリトライ付きで実行する。
 * 一時エラーのときのみ baseDelayMs * 2^attempt（+ジッター）待って再試行。
 * 非一時エラー、または再試行を使い切った場合は最後のエラーを throw する。
 */
export async function createMessageWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  { retries = 2, baseDelayMs = 500 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<Anthropic.Message> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.messages.create(params);
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryableError(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 200;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
