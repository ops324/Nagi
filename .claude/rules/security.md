# セキュリティ規約

## 環境変数管理

| 変数名 | 用途 | 公開範囲 |
|--------|------|---------|
| `ANTHROPIC_API_KEY` | Claude API（AIコメント生成） | サーバーのみ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase接続URL | 全クライアント |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Publishable key | 全クライアント（RLS適用） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Secret key（管理者操作） | サーバーのみ |

### ルール

- `.env.local` は `.gitignore` で Git 管理外
- `ANTHROPIC_API_KEY` は `app/api/` のAPIルートのみ使用
- `SUPABASE_SERVICE_ROLE_KEY` は `NEXT_PUBLIC_` プレフィックスを付けない
- `SUPABASE_SERVICE_ROLE_KEY` は `app/api/account/delete/route.ts` のみ使用（`createAdminClient`）

## 認証ガード（proxy.ts）

Next.js middleware として全ルートを保護：

```
リクエスト → proxy.ts
├── セッションなし → /auth/login にリダイレクト
├── セッションあり + /auth/* → / にリダイレクト（ログイン済みの場合）
└── セッションあり + その他 → 通過
```

### 管理者保護（二重ガード）

1. **proxy.ts**: 認証チェック（未認証は弾く）
2. **app/admin/layout.tsx**: サーバーコンポーネントで `is_admin` チェック（非管理者は `/` にリダイレクト）

```typescript
// app/admin/layout.tsx の基本パターン
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
const { data: profile } = await supabase
  .from("profiles")
  .select("is_admin")
  .eq("id", user.id)
  .single();
if (!profile?.is_admin) redirect("/");
```

## Supabase RLS（データ分離）

**原則**: RLS は必ず有効化。ユーザーは自分のデータのみ操作可能。

- `profiles`: `auth.uid() = id` のみ SELECT / UPDATE 可
- `entries`: `auth.uid() = user_id` のみ SELECT / INSERT / DELETE 可
- 管理者は `is_admin()` 関数（SECURITY DEFINER）でRLSをバイパスして全データ参照可

**`is_admin()` 関数の注意**: SECURITY DEFINER のため、関数定義の変更は慎重に。

## 入力バリデーション

### フロントエンド

| 場所 | バリデーション |
|------|-------------|
| 記録入力フォーム | 空文字チェック（trim後0文字はAPI呼び出しなし） |
| パスワード変更 | 6文字以上・確認入力一致チェック |
| アカウント削除 | メールアドレス入力による二重確認 |

### サーバーサイド（APIルート）

```typescript
// app/api/comment/route.ts
if (!content || content.trim().length === 0) {
  return NextResponse.json({ error: "内容が空です" }, { status: 400 });
}
```

## アカウント削除の安全な処理順序

1. セッションからユーザーIDを取得・認証確認
2. `entries` テーブルから当該ユーザーの全記録を削除
3. `profiles` テーブルから当該ユーザーのプロフィールを削除
4. `auth.admin.deleteUser()` でAuthユーザーを削除（`createAdminClient` 使用）

**この順序を守ること**（外部キー制約のため逆順にしない）。

## XSS 対策

- React の JSX レンダリングは自動エスケープ（dangerouslySetInnerHTML は使用しない）
- ユーザー入力をHTMLとして直接挿入しない
- AIコメントはプレーンテキストとして扱う（HTMLパースしない）

## APIキー露出チェックリスト

新しいコードを書く際に確認：

- [ ] `ANTHROPIC_API_KEY` はサーバーサイドのみで参照しているか
- [ ] `SUPABASE_SERVICE_ROLE_KEY` は `createAdminClient` 経由でのみ使用しているか
- [ ] Client Component で `process.env.SUPABASE_SERVICE_ROLE_KEY` を参照していないか
- [ ] `NEXT_PUBLIC_` 以外の環境変数をブラウザで参照していないか

## セキュリティ設定（Vercel本番環境）

環境変数は Vercel Dashboard で設定（コードには含めない）：
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
