"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
    });

    if (error) {
      setError("送信に失敗しました。メールアドレスを確認してください");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
          <p className="text-xs tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>パスワードの再設定</p>

          {sent ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                パスワード再設定用のメールを送信しました。メールに記載されたリンクからパスワードを再設定してください。
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
            </div>
          ) : (
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
                {loading ? "送信中…" : "再設定メールを送信"}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          <Link href="/auth/login" className="underline" style={{ color: "var(--text-secondary)" }}>
            ログインに戻る
          </Link>
        </p>
      </div>
    </div>
  );
}
