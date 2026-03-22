"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // メールアドレス変更
  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // パスワード変更
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // アカウント削除
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      setUserEmail(user.email ?? "");
      setLoading(false);
    };
    loadUser();
  }, []);

  // ── メールアドレス変更 ──────────────────────────────
  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || newEmail === userEmail) {
      setEmailMsg({ type: "error", text: "新しいメールアドレスを入力してください" });
      return;
    }
    setEmailLoading(true);
    setEmailMsg(null);

    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });

    if (error) {
      setEmailMsg({ type: "error", text: "変更に失敗しました。もう一度お試しください" });
    } else {
      setEmailMsg({ type: "success", text: "メールアドレスを変更しました" });
      setUserEmail(newEmail.trim());
      setNewEmail("");
    }
    setEmailLoading(false);
  };

  // ── パスワード変更 ──────────────────────────────────
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "パスワードは8文字以上で入力してください" });
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordMsg({ type: "error", text: "英字と数字の両方を含めてください" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "パスワードが一致しません" });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordMsg({ type: "error", text: "変更に失敗しました。もう一度お試しください" });
    } else {
      setPasswordMsg({ type: "success", text: "パスワードを変更しました" });
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  };

  // ── アカウント削除 ──────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== userEmail) {
      setDeleteMsg({ type: "error", text: "メールアドレスが正しくありません" });
      return;
    }
    setDeleteLoading(true);
    setDeleteMsg(null);

    const res = await fetch("/api/account/delete", { method: "DELETE" });

    if (!res.ok) {
      setDeleteMsg({ type: "error", text: "削除に失敗しました。もう一度お試しください" });
      setDeleteLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg)" }}>
        <p className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>

      {/* ヘッダー */}
      <header className="sticky top-0 z-10"
        style={{ backgroundColor: "var(--bg-header)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-lg mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <h1 className="text-2xl font-extralight tracking-[0.2em]" style={{ color: "var(--text-secondary)" }}>凪</h1>
          </Link>
          <p className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>アカウント設定</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8 space-y-6">

        {/* ── メールアドレス変更 ── */}
        <section className="rounded-3xl p-6 shadow-sm"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>メールアドレスの変更</p>

          <div className="mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-muted)" }}>現在：</span>{userEmail}
          </div>

          <form onSubmit={handleEmailChange} className="space-y-4">
            <div>
              <label className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                新しいメールアドレス
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={userEmail}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {emailMsg && (
              <p className="text-xs" style={{ color: emailMsg.type === "success" ? "#6ee7b7" : "#fca5a5" }}>
                {emailMsg.text}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={emailLoading || !newEmail.trim()}
                className="px-6 py-2.5 rounded-full text-xs tracking-widest transition-all"
                style={{
                  backgroundColor: emailLoading || !newEmail.trim() ? "var(--bg-disabled)" : "#6ee7b7",
                  color: emailLoading || !newEmail.trim() ? "var(--text-disabled)" : "#065f46",
                  cursor: emailLoading || !newEmail.trim() ? "not-allowed" : "pointer",
                }}
              >
                {emailLoading ? "変更中…" : "変更する"}
              </button>
            </div>
          </form>
        </section>

        {/* ── パスワード変更 ── */}
        <section className="rounded-3xl p-6 shadow-sm"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>パスワードの変更</p>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                新しいパスワード
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="8文字以上（英字+数字）"
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
                新しいパスワード（確認）
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            {passwordMsg && (
              <p className="text-xs" style={{ color: passwordMsg.type === "success" ? "#6ee7b7" : "#fca5a5" }}>
                {passwordMsg.text}
              </p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordLoading || !newPassword || !confirmPassword}
                className="px-6 py-2.5 rounded-full text-xs tracking-widest transition-all"
                style={{
                  backgroundColor: passwordLoading || !newPassword || !confirmPassword ? "var(--bg-disabled)" : "#6ee7b7",
                  color: passwordLoading || !newPassword || !confirmPassword ? "var(--text-disabled)" : "#065f46",
                  cursor: passwordLoading || !newPassword || !confirmPassword ? "not-allowed" : "pointer",
                }}
              >
                {passwordLoading ? "変更中…" : "変更する"}
              </button>
            </div>
          </form>
        </section>

        {/* ── アカウント削除 ── */}
        <section className="rounded-3xl p-6 shadow-sm"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>アカウントの削除</p>
          <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            アカウントとすべての記録データが完全に削除されます。この操作は取り消せません。
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-6 py-2.5 rounded-full text-xs tracking-widest transition-all"
              style={{
                backgroundColor: "transparent",
                border: "1px solid #fca5a5",
                color: "#fca5a5",
                cursor: "pointer",
              }}
            >
              アカウントを削除する
            </button>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl p-4" style={{ backgroundColor: "var(--bg)", border: "1px solid #fca5a5" }}>
                <p className="text-xs mb-3 leading-relaxed" style={{ color: "#fca5a5" }}>
                  確認のため、メールアドレス（{userEmail}）を入力してください
                </p>
                <input
                  type="email"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={userEmail}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                  style={{
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              {deleteMsg && (
                <p className="text-xs" style={{ color: "#fca5a5" }}>{deleteMsg.text}</p>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); setDeleteMsg(null); }}
                  className="px-6 py-2.5 rounded-full text-xs tracking-widest"
                  style={{
                    backgroundColor: "var(--bg)",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteConfirmText !== userEmail}
                  className="px-6 py-2.5 rounded-full text-xs tracking-widest transition-all"
                  style={{
                    backgroundColor: deleteLoading || deleteConfirmText !== userEmail ? "var(--bg-disabled)" : "#fca5a5",
                    color: deleteLoading || deleteConfirmText !== userEmail ? "var(--text-disabled)" : "#7f1d1d",
                    cursor: deleteLoading || deleteConfirmText !== userEmail ? "not-allowed" : "pointer",
                  }}
                >
                  {deleteLoading ? "削除中…" : "削除を実行する"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 戻るリンク */}
        <div className="text-center pb-4">
          <Link href="/" className="text-xs tracking-widest" style={{ color: "var(--text-muted)" }}>
            ← ホームに戻る
          </Link>
        </div>

      </main>
    </div>
  );
}
