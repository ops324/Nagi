# Nagi アーキテクチャ規約

## プロジェクト全体構成

```
Nagi/
├── app/                    # Next.js App Router
│   ├── admin/              # 管理者ダッシュボード（is_admin必須）
│   │   ├── layout.tsx      # サーバー側 is_admin チェック
│   │   └── page.tsx
│   ├── api/                # APIルート
│   │   ├── comment/        #   AIコメント（本番）＋ demo/（/try 用・認証なし）
│   │   ├── weekly-summary/ #   週次サマリー
│   │   ├── account/delete/ #   アカウント削除（createAdminClient）
│   │   └── cron/keepalive/ #   Supabase 維持（CRON_SECRET 保護・Vercel Cron 日次）
│   ├── auth/               # 認証ページ（login/signup はクライアント認証）
│   │   └── actions/index.ts  # Server Action（logout のみ）
│   ├── account/            # アカウント設定（認証必須）
│   ├── components/         # 共有UIコンポーネント（ui/ にプリミティブ）
│   ├── try/                # 登録前のお試し体験（公開ルート）
│   ├── preview/            # コンポーネントラボ（デザイン確認用）
│   ├── privacy/ terms/     # ポリシー・規約（公開ルート）
│   ├── lib/                # about.ts（世界観テキスト）・ripple.ts（波紋）
│   ├── globals.css         # デザイントークン・グローバルスタイル
│   ├── layout.tsx          # ThemeManager を全ルートに描画
│   ├── manifest.ts         # PWA マニフェスト
│   ├── global-error.tsx    # 致命的エラー（Sentry 報告）
│   ├── page.tsx            # メインページ（認証必須）
│   └── types.ts            # Entry型・感情カラー定義
├── lib/                    # 純ロジック（*.test.ts を隣に置き Vitest で担保）
│   ├── supabase/
│   │   ├── client.ts       # ブラウザ用クライアント
│   │   ├── middleware.ts   # セッション更新（proxy.ts から呼ぶ）
│   │   └── server.ts       # サーバー用クライアント（通常・Admin）
│   ├── origin-check.ts     # Origin/CSRF 検証
│   ├── rate-limit.ts       # 分散レート制限
│   ├── generate-comment.ts # コメント生成（本番と /try で共有・入力長ティア）
│   ├── anthropic-retry.ts  # Anthropic API リトライ＋バックオフ
│   ├── mood-seed.ts        # 最小入力の種文生成
│   ├── solar.ts            # 日の出・日の入りとテーマの時刻フェーズ
│   └── log.ts              # 構造化ログ（本番は Sentry）
├── prompts/
│   ├── system-prompt.ts        # AIコメント用システムプロンプト
│   └── weekly-summary-prompt.ts # 週次サマリー用システムプロンプト
├── docs/
│   ├── 仕様書.md
│   └── supabase-setup.sql
├── .claude/rules/          # Claudeコーディング規約（本ディレクトリ）
└── proxy.ts                # 認証ガード（Next.js proxy）
```

## ファイル命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| React コンポーネント | PascalCase | `EmotionCalendar.tsx` |
| API ルート | Next.js 規約 | `app/api/xxx/route.ts` |
| Server Actions | camelCase 関数 | `logout()`（login/signup はクライアント認証） |
| Supabase クライアント | `client.ts` / `server.ts` | — |
| 型定義 | `types.ts` に集約 | `Entry`, `Emotion` |
| ルール・仕様書 | 日本語可 | `仕様書.md` |

## データ型命名規則

- **フロントエンド（TypeScript）**: camelCase
  - `createdAt`, `userId`, `insightLevel`
- **DB（Supabase/PostgreSQL）**: snake_case
  - `created_at`, `user_id`, `insight_level`
- **変換**: DB取得時に明示的にマッピング（camelCase変換バグを防ぐ）

```typescript
// 正しいパターン
const entries = data.map((e) => ({
  id: e.id,
  content: e.content,
  createdAt: e.created_at,   // ← 明示的に変換
  insightLevel: e.insight_level,
}));
```

## デザイン哲学

**Calm Technology × Soft Minimalism**
- 主張せず、そっと寄り添うUI
- 余白と柔らかさで安心感を生む
- 生産性ツールではなく、静かな日記帳の体験

### カラーパレット（デザイントークン）

| 用途 | コード |
|------|--------|
| 背景 | `#f7f5f0` |
| カード背景 | `#ffffff` |
| ボーダー | `#ede9e3` |
| テキスト（主） | `#44403c` |
| テキスト（副） | `#78716c` |
| アクセントグリーン | `#6ee7b7` |

### テーマ

**その日の太陽に連動**（v1.86.0。それ以前は固定時刻）。計算は `lib/solar.ts`、付与は `app/components/ThemeManager.tsx`。

- ライト: 夜明け（市民薄明の始まり）〜 日没後の薄明の終わり（`#f7f5f0` 背景）
- ダーク: 薄明の外側＝夜（`#1a1816` 背景）
- 時刻4区分 `.time-morning/day/evening/night` と季節4種 `.season-*` をルートに付与
- 位置はタイムゾーンから推定（位置情報 API は使わない）
- 1分ごと自動チェック

**配色や区分を変えるときは `docs/仕様書.md` の「テーマ仕様」節も同時に更新する。**

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| チャート | Recharts |
| AI | Anthropic claude-haiku-4-5-20251001 |
| 認証・DB | Supabase（Auth + PostgreSQL） |
| ホスティング | Vercel（関数リージョン syd1・Vercel Cron） |
| テスト | Vitest（`lib/**/*.test.ts`）＋ Playwright（e2e・VRT） |
| 監視 | Sentry（エラー＋keepalive の死活監視） |
