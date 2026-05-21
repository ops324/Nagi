"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// login / signup は対話的UX（インラインのエラー・ローディング表示）のため
// クライアント側で signInWithPassword / signUp を直接呼ぶ実装を採用している
// （app/auth/login/page.tsx・signup/page.tsx）。Server Action は logout のみ。

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}
