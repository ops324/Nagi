import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
    getEnvOrThrow("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

/**
 * service_role で実行する管理用クライアント（RLS をバイパスする）。
 *
 * **cookie を渡してはいけない。**
 * @supabase/ssr の createServerClient に service role key を渡しても、supabase-js の
 * `_getAccessToken()` が cookie 上のセッションを見つけると `data.session.access_token`
 * （＝ログイン中ユーザーの JWT）を返し、`Authorization: Bearer <user JWT>` で上書きされる
 * （node_modules/@supabase/supabase-js/dist/index.cjs の _getAccessToken / fetchWithAuth）。
 * PostgREST はロールを apikey ではなく Authorization の JWT で決定するため、
 * service_role のつもりが authenticated として実行される。
 *
 * 実際に v1.82.0 で profiles の権限を正した際、この降格が原因で
 * app/api/account/delete/route.ts の profiles DELETE が 42501 になり、
 * 「entries だけ消えてアカウントが残る」部分削除を起こしていた。
 *
 * cookies() を呼ばないので同期関数で足りるが、呼び出し側（lib/rate-limit.ts・
 * app/api/account/delete/route.ts）が `await` している既存シグネチャを保つため async のまま残す。
 */
export async function createAdminClient() {
  return createSupabaseClient(
    getEnvOrThrow("NEXT_PUBLIC_SUPABASE_URL"),
    getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
