import { NextResponse } from "next/server";

// keep-warm 用の軽量ヘルスエンドポイント。
// 5分ごとに ping されサーバーレス関数／エッジ middleware を温め、
// コールドスタートによる初回表示の遅延を抑える。
// 認証・DB アクセスなし（固定 JSON）。force-dynamic で静的化させず必ず関数を実行する。
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true });
}
