import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateOrigin, validateCsrf } from "@/lib/origin-check";

export async function DELETE(request: NextRequest) {
  try {
    // Origin検証 + CSRF カスタムヘッダー検証
    const originError = validateOrigin(request);
    if (originError) return originError;
    const csrfError = validateCsrf(request);
    if (csrfError) return csrfError;

    // 認証済みユーザーを確認
    const supabase = await createClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

    if (claimsError || !claimsData?.claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = claimsData.claims.sub;

    // レート制限（1ユーザー 3回/時間 — 削除は頻繁に呼ばれるべきでない）
    const { success, resetAt } = await rateLimit(`delete:${userId}`, 3, 60 * 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { error: "リクエスト回数の上限に達しました" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // createAdminClient を使用（lib/supabase/server.ts に集約）
    const adminClient = await createAdminClient();

    // entries と profiles は CASCADE DELETE または手動削除
    await adminClient.from("entries").delete().eq("user_id", userId);
    await adminClient.from("profiles").delete().eq("id", userId);

    // auth ユーザー削除
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Account delete error:", deleteError);
      }
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Account delete error:", error);
    } else {
      console.error("Account delete error occurred");
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
