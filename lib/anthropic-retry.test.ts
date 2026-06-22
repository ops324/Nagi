import { afterEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createMessageWithRetry, isRetryableError } from "@/lib/anthropic-retry";

describe("isRetryableError", () => {
  it("一時的な HTTP ステータスは再試行対象", () => {
    for (const status of [408, 409, 429, 500, 502, 503, 504, 529]) {
      expect(isRetryableError({ status })).toBe(true);
    }
  });

  it("恒久的な HTTP ステータスは再試行しない", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isRetryableError({ status })).toBe(false);
    }
  });

  it("接続系エラー名は再試行対象", () => {
    expect(isRetryableError({ name: "APIConnectionError" })).toBe(true);
    expect(isRetryableError({ name: "APIConnectionTimeoutError" })).toBe(true);
  });

  it("status も既知の name も持たないものは再試行しない", () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
    expect(isRetryableError({})).toBe(false);
    expect(isRetryableError(new Error("boom"))).toBe(false);
  });
});

describe("createMessageWithRetry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const fakeMessage = { id: "msg_1" } as unknown as Anthropic.Message;
  const params = {} as Anthropic.MessageCreateParamsNonStreaming;

  function clientWith(create: ReturnType<typeof vi.fn>): Anthropic {
    return { messages: { create } } as unknown as Anthropic;
  }

  it("初回成功時はそのまま返し、1回だけ呼ぶ", async () => {
    const create = vi.fn().mockResolvedValue(fakeMessage);
    const result = await createMessageWithRetry(clientWith(create), params);
    expect(result).toBe(fakeMessage);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("一時エラーの後に成功すれば再試行して返す", async () => {
    vi.useFakeTimers();
    const create = vi
      .fn()
      .mockRejectedValueOnce({ status: 529 })
      .mockResolvedValueOnce(fakeMessage);
    const promise = createMessageWithRetry(clientWith(create), params);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toBe(fakeMessage);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("非一時エラーは即座に throw し、再試行しない", async () => {
    const err = { status: 400 };
    const create = vi.fn().mockRejectedValue(err);
    await expect(createMessageWithRetry(clientWith(create), params)).rejects.toBe(err);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("一時エラーが続けば retries 回再試行して最後のエラーを throw する", async () => {
    vi.useFakeTimers();
    const err = { status: 503 };
    const create = vi.fn().mockRejectedValue(err);
    const promise = createMessageWithRetry(clientWith(create), params, {
      retries: 2,
      baseDelayMs: 1,
    });
    const assertion = expect(promise).rejects.toBe(err);
    await vi.runAllTimersAsync();
    await assertion;
    expect(create).toHaveBeenCalledTimes(3); // 初回 + 2回再試行
  });
});
