/**
 * APIルートの Origin + CSRF 検証
 * CSRF攻撃を防ぐため、Origin検証 + カスタムヘッダー検証を行う。
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_URL, // 本番URL（Vercel環境変数で設定）
  "http://localhost:3000",
  "http://localhost:3001",
].filter(Boolean);

/**
 * Origin ヘッダーを検証する。
 * 不正なOriginの場合は 403 レスポンスを返し、正当な場合は null を返す。
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");

  // Originヘッダーがない場合（same-originリクエスト等）は許可
  // ブラウザはcross-originリクエスト時に必ずOriginを付与する
  if (!origin) return null;

  // 許可されたOriginか確認
  if (ALLOWED_ORIGINS.includes(origin)) return null;

  // Vercelプレビューデプロイ対応（自プロジェクトのURLのみ許可）
  if (
    origin === "https://nagi-xi.vercel.app" ||
    origin.match(/^https:\/\/nagi-[a-z0-9]+-[a-z0-9]+\.vercel\.app$/)
  ) return null;

  return NextResponse.json(
    { error: "Forbidden" },
    { status: 403 }
  );
}

/**
 * CSRF カスタムヘッダー検証（破壊的操作用）
 * ブラウザはクロスオリジンでカスタムヘッダーを付ける際に
 * CORS preflight が必要なため、外部サイトからの偽造を防ぐ。
 */
export function validateCsrf(request: NextRequest): NextResponse | null {
  const csrfHeader = request.headers.get("x-requested-with");
  if (csrfHeader !== "NagiApp") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403 }
    );
  }
  return null;
}
