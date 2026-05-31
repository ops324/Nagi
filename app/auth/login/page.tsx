"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DEV_AUTOFILL = process.env.NEXT_PUBLIC_DEV_AUTOFILL === "1";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState(DEV_AUTOFILL ? "dev@nagi.local" : "");

  useEffect(() => {
    const checkAlreadyAuthenticated = async () => {
      const { data: claimsData, error } = await supabase.auth.getClaims();
      if (!error && claimsData?.claims) {
        router.replace("/");
      }
    };
    checkAlreadyAuthenticated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [password, setPassword] = useState(DEV_AUTOFILL ? "nagidev" : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        setError("メールアドレスの確認が完了していません。受信メールのリンクをクリックするか、Supabaseでメール確認を無効にしてください");
      } else {
        setError("メールアドレスまたはパスワードが正しくありません");
      }
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: "var(--bg)" }}>
      <div className="w-full max-w-sm">

        {/* ロゴ */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extralight tracking-[0.3em]" style={{ color: "var(--text-secondary)" }}>凪</h1>
          <p className="text-xs tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>Nagi · 自己観察の記録</p>
        </div>

        {/* フォーム */}
        <div className="rounded-3xl p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                メールアドレス
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                パスワード
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <p role="alert" aria-live="polite" className="text-xs min-h-[1rem]"
              style={{ color: error ? "var(--color-danger)" : "transparent" }}>
              {error || "　"}
            </p>

            <button
              type="submit"
              disabled={loading}
              aria-disabled={loading}
              className="w-full py-3 rounded-full text-xs tracking-widest transition-all mt-2"
              style={{
                backgroundColor: loading ? "var(--bg-disabled)" : "var(--green)",
                color: loading ? "var(--text-disabled)" : "var(--color-btn-text)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "確認中…" : "ログイン"}
            </button>
          </form>
        </div>

        <div className="text-center text-xs mt-6 space-y-2">
          <p style={{ color: "var(--text-muted)" }}>
            <Link href="/auth/forgot-password" className="underline" style={{ color: "var(--text-secondary)" }}>
              パスワードを忘れた方
            </Link>
          </p>
          <p style={{ color: "var(--text-muted)" }}>
            アカウントをお持ちでない方は{" "}
            <Link href="/auth/signup" className="underline" style={{ color: "var(--text-secondary)" }}>
              新規登録
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
