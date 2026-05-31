import type { NextConfig } from "next";

// connect-src は本番リモート Supabase に加えて、ローカル開発時の
// NEXT_PUBLIC_SUPABASE_URL（例: http://localhost:54421）も許可する。
// 本番ビルド（Vercel）では NEXT_PUBLIC_SUPABASE_URL が prod URL に解決されるため
// 重複排除して 1 件にまとめる。
const PROD_SUPABASE_URL = "https://ahrppujhrfvwimfmropx.supabase.co";
const connectSrcSources = new Set<string>([
  "'self'",
  PROD_SUPABASE_URL,
  "https://api.anthropic.com",
]);
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  connectSrcSources.add(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval
      "style-src 'self' 'unsafe-inline'", // Tailwind inline styles
      "img-src 'self' data: https:",
      "font-src 'self'",
      `connect-src ${Array.from(connectSrcSources).join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
