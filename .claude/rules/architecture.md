# Nagi アーキテクチャ規約

## プロジェクト全体構成

```
Nagi/
├── app/                    # Next.js App Router
│   ├── admin/              # 管理者ダッシュボード（is_admin必須）
│   │   ├── layout.tsx      # サーバー側 is_admin チェック
│   │   └── page.tsx
│   ├── api/comment/        # AIコメント+感情抽出 APIルート
│   ├── auth/               # 認証ページ（login/signup）
│   │   └── actions/index.ts  # Server Actions（login/signup/logout）
│   ├── account/            # アカウント設定（認証必須）
│   ├── components/         # 共有UIコンポーネント
│   ├── globals.css         # デザイントークン・グローバルスタイル
│   ├── layout.tsx
│   ├── page.tsx            # メインページ（認証必須）
│   └── types.ts            # Entry型・感情カラー定義
├── lib/supabase/
│   ├── client.ts           # ブラウザ用クライアント
│   └── server.ts           # サーバー用クライアント（通常・Admin）
├── prompts/
│   └── system-prompt.ts    # AIシステムプロンプト（分離管理）
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
| Server Actions | camelCase 関数 | `login()`, `signup()`, `logout()` |
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

- ライト: 6〜18時（`#f7f5f0` 背景）
- ダーク: 18〜6時（`#1a1816` 背景）
- 1分ごと自動チェック

## 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | Next.js (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS |
| チャート | Recharts |
| AI | Anthropic claude-haiku-4-5-20251001 |
| 認証・DB | Supabase（Auth + PostgreSQL） |
| ホスティング | Vercel |
