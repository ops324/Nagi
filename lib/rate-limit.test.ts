import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase Admin クライアントをモックする。
const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => createAdminClient(),
}));

import { rateLimit } from "@/lib/rate-limit";

beforeEach(() => {
  createAdminClient.mockReset();
});

describe("rateLimit - DB 正常時", () => {
  it("RPC の結果をそのまま返す", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: { success: true, remaining: 5, reset_at: 999 }, error: null });
    createAdminClient.mockResolvedValue({ rpc });

    const result = await rateLimit("db-key", 10, 60_000);
    expect(result).toEqual({ success: true, remaining: 5, resetAt: 999 });
    // windowMs はミリ秒→秒に変換して RPC へ渡す
    expect(rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "db-key",
      p_limit: 10,
      p_window_seconds: 60,
    });
  });
});

describe("rateLimit - インメモリフォールバック", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("DB 接続失敗時はメモリでカウントし、上限超過で拒否する", async () => {
    createAdminClient.mockRejectedValue(new Error("DB down"));
    const key = `mem-${Math.random()}`;

    const first = await rateLimit(key, 2, 60_000);
    expect(first).toMatchObject({ success: true, remaining: 1 });

    const second = await rateLimit(key, 2, 60_000);
    expect(second).toMatchObject({ success: true, remaining: 0 });

    const third = await rateLimit(key, 2, 60_000);
    expect(third).toMatchObject({ success: false, remaining: 0 });
  });

  it("RPC がエラーを返した場合もメモリにフォールバックする", async () => {
    createAdminClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("rpc error") }),
    });
    const result = await rateLimit(`mem-rpcerr-${Math.random()}`, 5, 60_000);
    expect(result).toMatchObject({ success: true, remaining: 4 });
  });

  it("ウィンドウ経過後はカウントがリセットされる", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    createAdminClient.mockRejectedValue(new Error("DB down"));
    const key = `mem-reset-${Math.random()}`;

    await rateLimit(key, 1, 1_000); // remaining 0
    const blocked = await rateLimit(key, 1, 1_000);
    expect(blocked.success).toBe(false);

    vi.setSystemTime(2_000); // ウィンドウ(1秒)を経過
    const afterReset = await rateLimit(key, 1, 1_000);
    expect(afterReset.success).toBe(true);
  });
});
