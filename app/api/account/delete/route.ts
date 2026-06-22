import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateOrigin, validateCsrf } from "@/lib/origin-check";
import { logError } from "@/lib/log";

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

    // entries → profiles の順で削除（外部キー制約のため逆順にしない）
    const { error: entriesError } = await adminClient.from("entries").delete().eq("user_id", userId);
    if (entriesError) {
      logError(entriesError, { scope: "api/account/delete:entries" });
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    const { error: profilesError } = await adminClient.from("profiles").delete().eq("id", userId);
    if (profilesError) {
      logError(profilesError, { scope: "api/account/delete:profiles" });
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    // auth ユーザー削除
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      logError(deleteError, { scope: "api/account/delete:auth" });
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(error, { scope: "api/account/delete" });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
