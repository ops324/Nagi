import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "利用規約 | Nagi",
};

export default function TermsPage() {
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
            利用規約
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
          <Section title="1. 本サービスについて">
            <p>
              Nagi（以下「本サービス」）は、自己観察を目的とした日記アプリです。
              ユーザーが日々の感情や思考を記録し、AIによるコメントと感情分析を通じて
              自己理解を深めることを目的としています。
            </p>
          </Section>

          <Section title="2. 利用条件">
            <ul className="space-y-2">
              <li>・ 本サービスの利用にはアカウント登録（メールアドレス・パスワード）が必要です</li>
              <li>・ 本サービスは現在無料でご利用いただけます</li>
              <li>・ 本規約に同意いただいた方のみご利用ください</li>
            </ul>
          </Section>

          <Section title="3. 禁止事項">
            <p className="mb-3">ユーザーは以下の行為を行ってはなりません。</p>
            <ul className="space-y-2">
              <li>・ 本サービスへの不正アクセス・サーバーへの攻撃行為</li>
              <li>・ 他のユーザーのデータへの不正なアクセス・取得</li>
              <li>・ 本サービスに過度な負荷をかける行為（スクレイピング等）</li>
              <li>・ 法令または公序良俗に違反する目的での利用</li>
              <li>・ AIへの意図的なプロンプトインジェクション攻撃</li>
              <li>・ その他、運営者が不適切と判断する行為</li>
            </ul>
          </Section>

          <Section title="4. AIコメントについて">
            <p>
              本サービスが提供するAIコメント・感情分析は、自己観察を支援することを目的としており、
              医療・心理療法・カウンセリングの代替となるものではありません。
              AIの出力内容はあくまで参考情報であり、その正確性・完全性を保証するものではありません。
            </p>
          </Section>

          <Section title="5. 免責事項">
            <ul className="space-y-2">
              <li>・ 本サービスはデータの保全を努力目標としますが、データの損失に対して責任を負いません</li>
              <li>・ サービスの停止・障害・中断による損害について、運営者は責任を負いません</li>
              <li>・ AIが生成するコメントの内容に起因するいかなる損害についても、運営者は責任を負いません</li>
              <li>・ 本サービスを通じて得た情報の利用は、ユーザー自身の判断と責任において行ってください</li>
            </ul>
          </Section>

          <Section title="6. サービスの変更・終了">
            <p>
              運営者は、ユーザーへの事前通知なく本サービスの内容変更・機能の追加・削除、
              またはサービスの停止・終了を行う場合があります。
              これによりユーザーに生じた損害について、運営者は責任を負いません。
            </p>
          </Section>

          <Section title="7. 知的財産権">
            <p>
              本サービスのデザイン・コード・ロゴ等に関する知的財産権は運営者に帰属します。
              ユーザーが本サービスに入力した記録内容の著作権はユーザーに帰属します。
            </p>
          </Section>

          <Section title="8. 規約の変更">
            <p>
              運営者は必要に応じて本規約を変更することがあります。
              重要な変更がある場合はサービス内でお知らせします。
              変更後も継続してご利用いただく場合は、変更後の規約をご確認いただけますと幸いです。
            </p>
          </Section>

          <Section title="9. 準拠法・管轄">
            <p>
              本規約は日本法に準拠します。本サービスに関する紛争については、
              運営者の所在地を管轄する裁判所を専属的合意管轄とします。
            </p>
          </Section>

          <Section title="10. お問い合わせ">
            <p>
              本規約に関するご質問・ご不明な点は、下記メールアドレスまでご連絡ください。
            </p>
            <p className="mt-2" style={{ color: "var(--text-secondary)" }}>
              support@flowmate.jp
            </p>
          </Section>
        </div>

        <div className="text-center mt-8">
          <Link
            href="/privacy"
            className="text-xs tracking-widest underline"
            style={{ color: "var(--text-muted)" }}
          >
            プライバシーポリシーはこちら
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
