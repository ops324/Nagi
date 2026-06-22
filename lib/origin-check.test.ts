import { describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { validateCsrf, validateOrigin } from "@/lib/origin-check";

// validateOrigin / validateCsrf は request.headers.get() しか使わないため、
// 最小限のモックリクエストで十分。
function mockRequest(headers: Record<string, string | null>): NextRequest {
  return {
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
  } as unknown as NextRequest;
}

describe("validateOrigin", () => {
  it("Origin ヘッダーがなければ許可（same-origin）", () => {
    expect(validateOrigin(mockRequest({}))).toBeNull();
  });

  it("ローカル開発の Origin は許可", () => {
    expect(validateOrigin(mockRequest({ origin: "http://localhost:3000" }))).toBeNull();
    expect(validateOrigin(mockRequest({ origin: "http://localhost:3001" }))).toBeNull();
  });

  it("本番 Origin は許可", () => {
    expect(validateOrigin(mockRequest({ origin: "https://nagi-xi.vercel.app" }))).toBeNull();
  });

  it("当チームの Vercel プレビュー URL は許可", () => {
    const preview =
      "https://nagi-git-feature-x-flowmateops-5002s-projects.vercel.app";
    expect(validateOrigin(mockRequest({ origin: preview }))).toBeNull();
  });

  it("無関係な Origin は 403", () => {
    const res = validateOrigin(mockRequest({ origin: "https://evil.example.com" }));
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("他チームの nagi-* プレビューは弾く", () => {
    const res = validateOrigin(
      mockRequest({ origin: "https://nagi-git-x-someoneelse-projects.vercel.app" })
    );
    expect(res?.status).toBe(403);
  });
});

describe("validateCsrf", () => {
  it("正しいカスタムヘッダーなら許可", () => {
    expect(validateCsrf(mockRequest({ "x-requested-with": "NagiApp" }))).toBeNull();
  });

  it("ヘッダーが無い／異なる場合は 403", () => {
    expect(validateCsrf(mockRequest({}))?.status).toBe(403);
    expect(validateCsrf(mockRequest({ "x-requested-with": "other" }))?.status).toBe(403);
  });
});
