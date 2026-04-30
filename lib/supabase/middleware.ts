import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() でローカル JWT 検証・セッションリフレッシュ
  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthenticated = !!claimsData?.claims;

  const { pathname } = request.nextUrl;

  // 公開ページ・コールバックは通過
  const publicPaths = ["/privacy", "/terms", "/auth/callback"];
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // 未ログインユーザーを /auth/login にリダイレクト
  if (!isAuthenticated && !pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  // パスワード再設定ページはリカバリーセッションで通過を許可
  if (isAuthenticated && pathname === "/auth/reset-password") {
    return supabaseResponse;
  }

  // ログイン済みユーザーが /auth/* にアクセスしたらトップへ
  if (isAuthenticated && pathname.startsWith("/auth")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}
