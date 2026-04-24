import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "プライバシーポリシー | Nagi",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen px-6 py-16" style={{ backgroundColor: "var(--bg)" }}>
      <div className="max-w-2xl mx-auto">

        {/* ヘッダー */}
        <div className="mb-12">
          <Link
            href="/auth/login"
            className="text-xs tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            ← Nagi
          </Link>
          <h1
            className="text-2xl font-extralight tracking-widest mt-6"
            style={{ color: "var(--text-primary)" }}
          >
            プライバシーポリシー
          </h1>
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            制定日：2026年4月24日
          </p>
        </div>

        {/* 本文 */}
        <div
          className="rounded-3xl p-8 space-y-8"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <Section title="1. はじめに">
            <p>
              Nagi（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の適切な保護に努めます。
              本ポリシーは、本サービスが収集する情報の種類・利用目的・管理方法について説明するものです。
            </p>
          </Section>

          <Section title="2. 収集する情報">
            <ul className="space-y-2">
              <li>・ メールアドレス（アカウント登録時）</li>
              <li>・ パスワード（Supabase Authにより暗号化して管理、平文では保存しません）</li>
              <li>・ 日記の記録内容（ユーザーが入力したテキスト）</li>
              <li>・ AIが生成した感情スコア・コメント・エネルギーレベル</li>
              <li>・ 記録の作成日時</li>
            </ul>
          </Section>

          <Section title="3. 情報の利用目的">
            <ul className="space-y-2">
              <li>・ アカウントの作成・認証・管理</li>
              <li>・ AIによる感情分析とコメントの生成</li>
              <li>・ 感情カレンダー・グラフなどの機能提供</li>
              <li>・ サービスの品質向上・運営</li>
            </ul>
          </Section>

          <Section title="4. 第三者へのデータ送信">
            <p className="mb-3">
              本サービスは以下の外部サービスを利用しています。各サービスのプライバシーポリシーもご確認ください。
            </p>
            <div className="space-y-4">
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                  Supabase（データベース・認証）
                </p>
                <p>
                  メールアドレス・記録データの保存・管理に使用します。データはオーストラリア（シドニー）のサーバーに保管されます。
                </p>
              </div>
              <div
                className="rounded-2xl p-4"
                style={{ backgroundColor: "var(--bg)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                  Anthropic（Claude API）
                </p>
                <p>
                  日記の内容をAIによる感情分析・コメント生成のために送信します。送信されるのは記録テキストのみです。Anthropicがデータを学習目的で保持・使用することはありません（APIポリシーに準拠）。
                </p>
              </div>
            </div>
          </Section>

          <Section title="5. データのセキュリティ">
            <ul className="space-y-2">
              <li>・ すべてのデータ通信はHTTPS（TLS）で暗号化されます</li>
              <li>・ 行レベルセキュリティ（RLS）により、ユーザーは自分のデータのみにアクセスできます</li>
              <li>・ パスワードはハッシュ化され、平文では保存されません</li>
            </ul>
          </Section>

          <Section title="6. ユーザーの権利">
            <ul className="space-y-2">
              <li>・ アカウント設定ページから、いつでもすべての記録データを削除できます</li>
              <li>・ アカウントを削除すると、記録・プロフィール・認証情報がすべて完全に削除されます</li>
              <li>・ 削除されたデータは復元できません</li>
            </ul>
          </Section>

          <Section title="7. Cookie・ローカルストレージ">
            <p>
              本サービスは認証セッションの維持のためにCookieを使用します。
              サービスの利用には必須のCookieのみ使用し、トラッキング目的のCookieは使用しません。
            </p>
          </Section>

          <Section title="8. ポリシーの変更">
            <p>
              本ポリシーは必要に応じて変更されることがあります。
              重要な変更がある場合はサービス内でお知らせします。
            </p>
          </Section>

          <Section title="9. お問い合わせ">
            <p>
              プライバシーに関するご質問・ご要望は、下記メールアドレスまでご連絡ください。
            </p>
            <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
              support@flowmate.jp
            </p>
          </Section>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/terms"
            className="text-xs tracking-widest underline"
            style={{ color: "var(--text-muted)" }}
          >
            利用規約はこちら
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2
        className="text-xs tracking-widest mb-3"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
      </h2>
      <div className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
        {children}
      </div>
    </div>
  );
}
