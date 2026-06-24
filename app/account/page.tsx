"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { logout } from "../auth/actions";
import { Dialog } from "../components/ui/Dialog";
import { ABOUT_INTRO } from "../lib/about";

export default function AccountPage() {
  const router = useRouter();
  // @supabase/ssr は内部でシングルトン。useMemo で参照を安定させ、
  // 認証チェック effect の依存に含められるようにする（exhaustive-deps 対策）。
  const supabase = useMemo(() => createClient(), []);

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
  const [showDeletedDialog, setShowDeletedDialog] = useState(false);


  useEffect(() => {
    const loadUser = async () => {
      const { data: claimsData, error } = await supabase.auth.getClaims();
      if (error || !claimsData?.claims) {
        router.replace("/auth/login");
        return;
      }
      setUserEmail(claimsData.claims.email ?? "");
      setLoading(false);
    };
    loadUser();
  }, [router, supabase]);

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

    const res = await fetch("/api/account/delete", {
      method: "DELETE",
      headers: { "X-Requested-With": "NagiApp" },
    });

    if (!res.ok) {
      setDeleteMsg({ type: "error", text: "削除に失敗しました。もう一度お試しください" });
      setDeleteLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setShowDeleteConfirm(false);
    setDeleteConfirmText("");
    setShowDeletedDialog(true);
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

        {/* ── 凪について ── */}
        <section className="rounded-3xl p-6 elev-1"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>凪について</p>
          <p className="text-xs leading-loose" style={{ color: "var(--text-secondary)" }}>
            {ABOUT_INTRO}
          </p>
        </section>

        {/* ── メールアドレス変更 ── */}
        <section className="rounded-3xl p-6 elev-1"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>メールアドレスの変更</p>

          <div className="mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-muted)" }}>現在：</span>{userEmail}
          </div>

          <form onSubmit={handleEmailChange} className="space-y-4">
            <div>
              <label htmlFor="account-email" className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                新しいメールアドレス
              </label>
              <input
                id="account-email"
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

            <p role="alert" aria-live="polite" className="text-xs min-h-[1rem]"
              style={{ color: emailMsg ? (emailMsg.type === "success" ? "var(--green)" : "var(--color-danger)") : "transparent" }}>
              {emailMsg?.text || "　"}
            </p>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={emailLoading || !newEmail.trim()}
                aria-disabled={emailLoading || !newEmail.trim()}
                className="btn-primary px-6 py-2.5 rounded-full text-xs tracking-widest"
                style={{
                  backgroundColor: emailLoading || !newEmail.trim() ? "var(--bg-disabled)" : "var(--green)",
                  color: emailLoading || !newEmail.trim() ? "var(--text-disabled)" : "var(--color-btn-text)",
                  cursor: emailLoading || !newEmail.trim() ? "not-allowed" : "pointer",
                }}
              >
                {emailLoading ? "変更中…" : "変更する"}
              </button>
            </div>
          </form>
        </section>

        {/* ── パスワード変更 ── */}
        <section className="rounded-3xl p-6 elev-1"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>パスワードの変更</p>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label htmlFor="account-new-password" className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                新しいパスワード
              </label>
              <p id="account-pw-hint" className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>
                8文字以上・英字と数字を含めてください
              </p>
              <input
                id="account-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                aria-describedby="account-pw-hint"
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div>
              <label htmlFor="account-confirm-password" className="block text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                新しいパスワード（確認）
              </label>
              <input
                id="account-confirm-password"
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

            <p role="alert" aria-live="polite" className="text-xs min-h-[1rem]"
              style={{ color: passwordMsg ? (passwordMsg.type === "success" ? "var(--green)" : "var(--color-danger)") : "transparent" }}>
              {passwordMsg?.text || "　"}
            </p>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordLoading || !newPassword || !confirmPassword}
                aria-disabled={passwordLoading || !newPassword || !confirmPassword}
                className="btn-primary px-6 py-2.5 rounded-full text-xs tracking-widest"
                style={{
                  backgroundColor: passwordLoading || !newPassword || !confirmPassword ? "var(--bg-disabled)" : "var(--green)",
                  color: passwordLoading || !newPassword || !confirmPassword ? "var(--text-disabled)" : "var(--color-btn-text)",
                  cursor: passwordLoading || !newPassword || !confirmPassword ? "not-allowed" : "pointer",
                }}
              >
                {passwordLoading ? "変更中…" : "変更する"}
              </button>
            </div>
          </form>
        </section>

        {/* ── アカウント削除 ── */}
        <section className="rounded-3xl p-6 elev-1"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-xs tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>アカウントの削除</p>
          <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
            アカウントとすべての記録データが完全に削除されます。この操作は取り消せません。
          </p>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-2.5 rounded-full text-xs tracking-widest transition-all"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--color-danger)",
              color: "var(--color-danger)",
              cursor: "pointer",
            }}
          >
            アカウントを削除する
          </button>
        </section>

        {/* ── 削除確認 Dialog ── */}
        <Dialog
          open={showDeleteConfirm}
          onOpenChange={(open) => {
            if (!open) { setDeleteConfirmText(""); setDeleteMsg(null); }
            setShowDeleteConfirm(open);
          }}
          title="アカウントの削除"
          description="アカウントとすべての記録データが完全に削除されます。この操作は取り消せません。"
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="delete-confirm-email" className="block text-xs tracking-widest mb-2"
                style={{ color: "var(--color-danger)" }}>
                確認のため、メールアドレスを入力してください
              </label>
              <input
                id="delete-confirm-email"
                type="email"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={userEmail}
                className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <p role="alert" aria-live="polite" className="text-xs min-h-[1rem]"
              style={{ color: deleteMsg ? "var(--color-danger)" : "transparent" }}>
              {deleteMsg?.text || "　"}
            </p>

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
                aria-disabled={deleteLoading || deleteConfirmText !== userEmail}
                className="px-6 py-2.5 rounded-full text-xs tracking-widest transition-all"
                style={{
                  backgroundColor: deleteLoading || deleteConfirmText !== userEmail ? "var(--bg-disabled)" : "var(--color-danger)",
                  color: deleteLoading || deleteConfirmText !== userEmail ? "var(--text-disabled)" : "var(--color-danger-text)",
                  cursor: deleteLoading || deleteConfirmText !== userEmail ? "not-allowed" : "pointer",
                }}
              >
                {deleteLoading ? "削除中…" : "削除を実行する"}
              </button>
            </div>
          </div>
        </Dialog>

        {/* ── 削除完了 Dialog ── */}
        <Dialog
          open={showDeletedDialog}
          onOpenChange={() => {}}
          title="アカウントを削除しました"
          description=""
        >
          <div className="space-y-5">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              これまで凪に記録してくれたこと、ありがとうございました。
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              あなたが書いた言葉は、すべて静かに消えました。またいつか、言葉を置きたくなったときに。
            </p>
            <div className="flex justify-center pt-2">
              <button
                onClick={() => router.replace("/auth/login")}
                className="btn-primary px-8 py-2.5 rounded-full text-xs tracking-widest"
                style={{
                  backgroundColor: "var(--green)",
                  color: "var(--color-btn-text)",
                  cursor: "pointer",
                }}
              >
                ログインページへ
              </button>
            </div>
          </div>
        </Dialog>

        {/* ログアウト */}
        <div className="text-center">
          <form action={logout}>
            <button
              type="submit"
              className="logout-ripple-btn text-xs tracking-widest px-6 py-2.5 rounded-full"
              style={{ border: "1px solid var(--border)", color: "var(--text-muted)", backgroundColor: "var(--bg)", cursor: "pointer" }}
              onPointerDown={(e) => {
                const btn = e.currentTarget;
                const rect = btn.getBoundingClientRect();
                const span = document.createElement("span");
                span.className = "ripple";
                span.style.top = `${e.clientY - rect.top}px`;
                span.style.left = `${e.clientX - rect.left}px`;
                btn.appendChild(span);
                span.addEventListener("animationend", () => span.remove());
              }}
            >
              ログアウト
            </button>
          </form>
        </div>

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
