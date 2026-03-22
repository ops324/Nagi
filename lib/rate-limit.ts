/**
 * 分散レート制限（Supabase DB ベース）
 *
 * Supabase の check_rate_limit() RPC を使い、
 * Vercel Serverless の複数インスタンスでも正確にカウントする。
 * DB接続失敗時はインメモリにフォールバック（単一インスタンス防御）。
 */

import { createAdminClient } from "@/lib/supabase/server";

// ── インメモリフォールバック ──
type RateLimitEntry = { count: number; resetAt: number };
const memoryStore = new Map<string, RateLimitEntry>();

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ── メインのレート制限関数 ──
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  try {
    const admin = await createAdminClient();
    const windowSeconds = Math.ceil(windowMs / 1000);

    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) throw error;

    return {
      success: data.success as boolean,
      remaining: data.remaining as number,
      resetAt: data.reset_at as number,
    };
  } catch {
    // DB接続失敗時: インメモリフォールバック
    if (process.env.NODE_ENV === "development") {
      console.warn("Rate limit: falling back to in-memory store");
    }
    return memoryRateLimit(key, limit, windowMs);
  }
}
