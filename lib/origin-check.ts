/**
 * APIルートの Origin 検証
 * CSRF攻撃を防ぐため、リクエスト元のOriginを検証する。
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

  // Vercelプレビューデプロイ対応（*.vercel.app）
  if (origin.endsWith(".vercel.app")) return null;

  return NextResponse.json(
    { error: "Forbidden" },
    { status: 403 }
  );
}
