"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import TryCta from "@/app/components/TryCta";
import { APP_SUBTITLE, PRIVACY_ASSURANCE, JP_PHRASE_WRAP } from "@/app/lib/about";

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
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden">
              <Image src="/icon-nagi.png" alt="Nagi" width={48} height={48} priority className="w-12 h-12 block" />
            </div>
            <h1 className="text-4xl font-extralight tracking-[0.3em]" style={{ color: "var(--text-secondary)" }}>凪</h1>
          </div>
          <p className="text-xs tracking-widest mt-2" style={{ color: "var(--text-muted)" }}>{APP_SUBTITLE}</p>
        </div>

        {/* 日記を預ける直前に「誰にも読まれない」ことを示す（v1.88.0）。
            根拠は RLS（entries は auth.uid() = user_id のみ）。 */}
        <p className="text-center text-xs leading-relaxed mb-8" style={{ color: "var(--text-muted)", ...JP_PHRASE_WRAP }}>
          {PRIVACY_ASSURANCE}
        </p>

        {/* フォーム */}
        <div className="rounded-3xl p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-6" style={{ color: "var(--text-muted)" }}>新規登録</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="signup-email" className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                メールアドレス
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                パスワード
              </label>
              <p id="signup-pw-hint" className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                8文字以上・英字と数字を含めてください
              </p>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-describedby="signup-pw-hint"
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
              className="btn-primary w-full py-3 rounded-full text-xs tracking-widest mt-2"
              style={{
                backgroundColor: loading ? "var(--bg-disabled)" : "var(--green)",
                color: loading ? "var(--text-disabled)" : "var(--color-btn-text)",
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

        {/* お試し体験への導線（テキストリンクから二次ボタンへ格上げ・v1.85.0） */}
        <TryCta />

        <p className="text-center text-xs mt-7" style={{ color: "var(--text-muted)" }}>
          ご登録の前に{" "}
          <Link href="/terms" className="underline" style={{ color: "var(--text-muted)" }}>
            利用規約
          </Link>
          {" "}と{" "}
          <Link href="/privacy" className="underline" style={{ color: "var(--text-muted)" }}>
            プライバシーポリシー
          </Link>
          {" "}をご確認ください
        </p>
      </div>
    </div>
  );
}
