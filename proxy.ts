import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // 静的アセット・previewルートを除外
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|preview|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
