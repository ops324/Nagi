"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("パスワードは8文字以上で設定してください");
      setLoading(false);
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("英字と数字の両方を含めてください");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError("登録に失敗しました。もう一度お試しください");
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
          <p className="text-xs tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>新規登録</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                メールアドレス
              </label>
              <input
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
              <label className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                パスワード（8文字以上・英字+数字）
              </label>
              <input
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

            {error && (
              <p className="text-xs" style={{ color: "#fca5a5" }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-full text-xs tracking-widest transition-all mt-2"
              style={{
                backgroundColor: loading ? "var(--bg-disabled)" : "#6ee7b7",
                color: loading ? "var(--text-disabled)" : "#065f46",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "登録中…" : "登録する"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          すでにアカウントをお持ちの方は{" "}
          <Link href="/auth/login" className="underline" style={{ color: "var(--text-secondary)" }}>
            ログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
