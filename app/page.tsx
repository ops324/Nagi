import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeClient from "./components/HomeClient";
import type { Entry } from "./types";

export default async function Home() {
  const supabase = await createClient();

  // 認証チェック（proxy.ts でも保護されるが、サーバー側でも明示）
  const { data: claimsData, error } = await supabase.auth.getClaims();
  if (error || !claimsData?.claims) redirect("/auth/login");
  const claims = claimsData.claims;
  const userId = claims.sub;

  // プロフィール（管理者判定）と記録を並列取得
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", userId).single(),
    supabase.from("entries").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
  ]);

  // Supabase は snake_case で返すため camelCase に明示マップ
  const initialEntries: Entry[] = (data ?? []).map((e): Entry => ({
    id:           e.id,
    content:      e.content,
    comment:      e.comment,
    emotions:     e.emotions ?? [],
    dominant:     e.dominant,
    energy:       e.energy,
    createdAt:    e.created_at,
    insightLevel: e.insight_level,
    note:         e.note ?? "",
    isFavorited:  e.is_favorited ?? false,
    recordedAt:   e.recorded_at ?? e.created_at,
  }));

  return (
    <HomeClient
      initialEntries={initialEntries}
      userEmail={claims.email ?? null}
      isAdmin={!!profile?.is_admin}
    />
  );
}
