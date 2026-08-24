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

### `public.rate_limits`

```sql
rate_limits (
  key text PRIMARY KEY,       -- 例: "comment:<user_id>" / "demo:<ip>"
  count integer,
  window_start timestamptz
)
```

RLS は有効。`anon`/`authenticated` からは `revoke all`（v1.83.0）で、アクセスは `lib/rate-limit.ts` が service_role で呼ぶ RPC `check_rate_limit()` のみ。
掃除は Supabase Cron（pg_cron）の `nagi-cleanup-rate-limits` が日次で `cleanup_rate_limits()` を実行（v1.84.0）。
**`cleanup_rate_limits()` の削除しきい値（2時間）より長いレート制限ウィンドウを作らないこと**（毎晩リセットされ無音で無効化される）。

### 管理者用ビュー

- `public.admin_analytics`: ユーザー別集計（総記録数・最終記録・平均エネルギー）
- `public.admin_emotion_stats`: 感情ラベル別集計

**両ビューは `with (security_invoker = on)` が必須**（v1.82.0）。これが無いとビュー所有者（postgres＝RLS 免除）の
権限で基底テーブルを読むため、一般ユーザーに全ユーザーの email 等が漏れる。

## RLS（Row Level Security）ポリシー設計方針

**原則**: RLS は必ず有効化。デフォルトは「自分のデータのみ」。

### 一般ユーザー向けポリシー

| テーブル | 操作 | ポリシー条件 |
|---------|------|-------------|
| profiles | SELECT | `auth.uid() = id` |
| entries | SELECT | `auth.uid() = user_id` |
| entries | INSERT | `auth.uid() = user_id` |
| entries | UPDATE | `auth.uid() = user_id`（余韻メモ・お気に入り・本文編集） |
| entries | DELETE | `auth.uid() = user_id` |

> **profiles に UPDATE ポリシーは存在しない（v1.82.0 で削除）。復活させないこと。**
> RLS は *行* を制御するが *列* は制御しないため、列を限定しない UPDATE ポリシー＋UPDATE 権限があると
> ブラウザから `update({ is_admin: true })` で自分を管理者に昇格でき、全ユーザーの日記本文が読めてしまう。
> **profiles に書き込みが必要な列を追加する場合も `authenticated` に UPDATE を戻さず、
> 必ず `createAdminClient`（service_role）経由のサーバーサイド更新にする。**

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

（アプリからは実行できない＝Supabase ダッシュボードの SQL Editor で行う。上記のとおり
`authenticated` に profiles の UPDATE 権限はない）

### テーブル権限（GRANT）

**「GRANT を書かない＝権限がない」ではない。** Supabase プロジェクト初期の default privileges により
`anon`/`authenticated` に `grant all` 相当が付いていることがある（v1.82.0 の本番実測で判明）。
そのため新規テーブル・ビューを追加するときは必ず **`revoke all` してから必要な権限だけ grant し直す**。

| 対象 | 付与する権限 |
|------|-------------|
| profiles | `authenticated` の SELECT のみ |
| entries | `authenticated` の SELECT/INSERT/UPDATE/DELETE ＋ **`anon` の SELECT**（keepalive が使う） |
| admin_analytics / admin_emotion_stats | `authenticated` の SELECT のみ |
| rate_limits | `anon`/`authenticated` は `revoke all`（service_role のみ） |

**SECURITY DEFINER 関数の EXECUTE も既定で PUBLIC に付く。** `check_rate_limit()` /
`cleanup_rate_limits()` は service_role のみに絞る（v1.83.0）。ただし **`is_admin()` は revoke してはいけない**
（RLS ポリシー内で呼び出しロールの権限で評価されるため、剥がすとアプリ全体が停止する）。

## クライアント使い分け

```typescript
// lib/supabase/client.ts  → ブラウザ（RLS適用・認証あり）
// lib/supabase/server.ts  → サーバー（RLS適用・認証あり）
// lib/supabase/server.ts（createAdminClient） → 管理者操作（RLSバイパス）
```

**`createAdminClient`（サービスロールキー）を使うのは APIルート／サーバーサイドのみ。**
具体的には `app/api/account/delete/route.ts`（アカウント削除）と `lib/rate-limit.ts`（`rate_limits` への RPC アクセス）の2箇所のみ。

**`createAdminClient()` に cookie を渡してはいけない**（v1.82.1）。PostgREST はロールを apikey ではなく
Authorization の JWT で決めるため、cookie 上のセッションがあると supabase-js が Authorization をユーザーの
JWT で上書きし、service_role ではなく `authenticated` として実行される（`auth.admin.*` だけは service_role のまま動くため気づきにくい）。

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
- `createAdminClient()` に cookie ストアを渡さない（service_role が `authenticated` に降格する）
- `auth.uid()` チェックなしのRLSポリシーを作成しない
- profiles に `authenticated` の UPDATE 権限・UPDATE ポリシーを戻さない
- 新規テーブル／ビューを `revoke all` なしで追加しない
- 管理ビューを `security_invoker = on` なしで作らない
