# Supabase 設計方針

## 接続情報

- **URL**: `https://ahrppujhrfvwimfmropx.supabase.co`
- **Region**: ap-southeast-2 (Sydney)
- **設定参照**: `docs/supabase-setup.sql`（累積管理）

## テーブル設計

### `public.profiles`

```sql
profiles (
  id uuid PRIMARY KEY,        -- auth.users.id と同一
  email text,
  is_admin boolean DEFAULT false,
  created_at timestamptz
)
```

### `public.entries`

```sql
entries (
  id text PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  content text,
  comment text,
  emotions jsonb,             -- [{ "label": string, "score": number }]
  dominant text,
  energy integer,             -- 1〜10
  created_at timestamptz,
  insight_level text DEFAULT 'moderate'  -- "deep" | "moderate" | "gentle"
)
```

### 管理者用ビュー

- `public.admin_analytics`: ユーザー別集計（総記録数・最終記録・平均エネルギー）
- `public.admin_emotion_stats`: 感情ラベル別集計

## RLS（Row Level Security）ポリシー設計方針

**原則**: RLS は必ず有効化。デフォルトは「自分のデータのみ」。

### 一般ユーザー向けポリシー

| テーブル | 操作 | ポリシー条件 |
|---------|------|-------------|
| profiles | SELECT | `auth.uid() = id` |
| profiles | UPDATE | `auth.uid() = id` |
| entries | SELECT | `auth.uid() = user_id` |
| entries | INSERT | `auth.uid() = user_id` |
| entries | DELETE | `auth.uid() = user_id` |

### 管理者向けポリシー

```sql
-- 管理者権限チェック関数（SECURITY DEFINER でRLSをバイパス）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  )
$$ LANGUAGE sql SECURITY DEFINER;

-- 管理者は全データ参照可
CREATE POLICY "管理者は全プロフィール参照可" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "管理者は全エントリ参照可" ON public.entries FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());
```

### 管理者権限の付与

```sql
UPDATE public.profiles SET is_admin = true WHERE email = '管理者のメールアドレス';
```

## クライアント使い分け

```typescript
// lib/supabase/client.ts  → ブラウザ（RLS適用・認証あり）
// lib/supabase/server.ts  → サーバー（RLS適用・認証あり）
// lib/supabase/server.ts（createAdminClient） → 管理者操作（RLSバイパス）
```

**`createAdminClient`（サービスロールキー）を使うのは APIルートのみ。**
具体的には `app/api/account/delete/route.ts` でアカウント削除時のみ。

## Auth 設定（確認済み）

| 設定 | 値 |
|------|-----|
| Email provider | 有効 |
| Confirm email | 無効（オフ） |
| Allow new users to sign up | 有効 |

## データ操作パターン

### 記録の取得（サーバーサイド）

```typescript
const { data, error } = await supabase
  .from("entries")
  .select("*")
  .order("created_at", { ascending: false });

// DBはsnake_case → TypeScriptはcamelCase に変換
const entries = data.map((e) => ({
  id: e.id,
  content: e.content,
  createdAt: e.created_at,    // 必ず明示的に変換
  insightLevel: e.insight_level,
  // ...
}));
```

### 記録の追加

```typescript
const { error } = await supabase.from("entries").insert({
  id: String(Date.now()),
  user_id: user.id,
  content,
  comment,
  emotions,
  dominant,
  energy,
  insight_level: insightLevel,  // snake_case でInsert
});
```

## テーブル変更時のルール

1. `docs/supabase-setup.sql` に `ALTER TABLE` を追記（累積管理）
2. 仕様書の「6.2 DBスキーマ」セクションを更新
3. `app/types.ts` の型定義を更新
4. フロントエンドのマッピングコードを更新

## 禁止事項

- RLSを無効化しない
- `SUPABASE_SERVICE_ROLE_KEY` をクライアントコードで使用しない
- `createAdminClient` をページコンポーネントやClient Componentで使用しない
- `auth.uid()` チェックなしのRLSポリシーを作成しない
