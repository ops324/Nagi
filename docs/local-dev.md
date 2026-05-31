# ローカル開発環境（Colima + Docker + Supabase CLI）

Nagi 専用のローカル Supabase スタックを Docker（Colima 経由）で動かして、
本番に触らず改良改善イテレーションを快適に回すための手順書。

## 構成

| 項目 | 値 |
|------|-----|
| コンテナランタイム | Colima（macOS Virtualization.Framework） |
| Supabase CLI | v2.x |
| project_id | `nagi`（コンテナ名は `supabase_*_nagi`） |
| API URL | `http://localhost:54421` |
| DB | `postgresql://postgres:postgres@localhost:54422/postgres` |
| Studio | `http://localhost:54423` |
| Inbucket（メール） | `http://localhost:54424` |

別プロジェクトのローカル Supabase（標準ポート 54321-54324）と**同時起動可能**な
ポート割り当てになっている（+100 オフセット）。

## 初回セットアップ

### 1. 前提

- Colima と Docker がインストール済み（`brew install colima docker`）
- Supabase CLI がインストール済み（`brew install supabase/tap/supabase`）

### 2. Colima を起動

```bash
colima status   # 起動していなければ次のコマンド
colima start
```

### 3. ローカル Supabase を起動

```bash
npm run db:start
```

初回は Docker イメージ pull で 3〜5 分かかる。完了すると以下のような出力が表示される：

```
         API URL: http://127.0.0.1:54421
     GraphQL URL: http://127.0.0.1:54421/graphql/v1
          DB URL: postgresql://postgres:postgres@127.0.0.1:54422/postgres
      Studio URL: http://127.0.0.1:54423
        anon key: eyJhbGciOi...        ← 控える
service_role key: eyJhbGciOi...        ← 控える
```

### 4. `.env.development.local` を作成

プロジェクトルートに `.env.development.local` を作り、上記の鍵を貼り付ける：

```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54421
NEXT_PUBLIC_SUPABASE_ANON_KEY=<上記の anon key>
SUPABASE_SERVICE_ROLE_KEY=<上記の service_role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_DEV_AUTOFILL=1
```

`.env.development.local` は `.gitignore` 済み（`.env*` パターン）。Next.js は `npm run dev` 時のみ
このファイルを自動ロードし、`.env.local` の同名キーを上書きする。本番ビルドには影響しない。

`NEXT_PUBLIC_DEV_AUTOFILL=1` を入れておくと、ログイン画面の入力欄が `dev@nagi.local` /
`nagidev` で埋まり、1クリックでログインできる。

### 5. アプリを起動

```bash
npm run dev
```

http://localhost:3000 → 「ログイン」をクリックすると `dev@nagi.local` でログイン完了。
シードされたサンプル記録が3件表示される。

## シードユーザー

seed.sql で以下が自動作成される：

| メール | パスワード | 権限 |
|--------|------------|------|
| `dev@nagi.local` | `nagidev` | 一般ユーザー（サンプル entries 3件入り） |
| `admin@nagi.local` | `nagiadmin` | `is_admin = true`（`/admin` にアクセス可） |

## 日常運用

```bash
npm run db:start    # 起動
npm run db:status   # ポート・鍵を再表示
npm run db:studio   # ブラウザで Studio を開く
npm run db:reset    # マイグレーション + seed を再適用（クリーン状態に戻す）
npm run db:stop     # 停止
```

## スキーマ変更したいとき

新しいマイグレーションを追加：

```bash
supabase migration new <変更内容>
# → supabase/migrations/YYYYMMDDHHMMSS_<変更内容>.sql が生成される
# SQL を書く
npm run db:reset    # 全マイグレーション + seed を再適用
```

本番反映は **CLI から直接 push しない**（CC-8 規定外）。
当面は `docs/supabase-setup.sql` に同じ SQL を `ALTER TABLE` 等の累積形式で追記し、
Supabase Dashboard > SQL Editor 経由で本番に反映する従来運用を維持する。

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `port already in use` | 別プロジェクトの Supabase が同じポートを使っている。`docker ps` で確認 |
| `Cannot connect to the Docker daemon` | `colima start` を実行 |
| Studio で "404 Not Found" | コンテナ起動直後はヘルスチェック中。30 秒ほど待つ |
| ログイン失敗 | `npm run db:reset` で seed を再適用。`.env.development.local` の鍵が正しいか確認 |
| Anthropic API のテストもしたい | `.env.local` の `ANTHROPIC_API_KEY` がそのまま引き継がれる（dev サーバーは両方ロードする） |

## 関連ファイル

| パス | 役割 |
|------|------|
| `supabase/config.toml` | ポート・project_id・Auth 設定 |
| `supabase/migrations/20260601000000_initial_schema.sql` | 初期スキーマ（profiles / entries / RLS / 関数等） |
| `supabase/seed.sql` | テストユーザー＋サンプル entries |
| `docs/supabase-setup.sql` | 本番用累積 SQL（従来運用、当面併存） |
| `.env.local` | 本番接続情報（Git 管理外） |
| `.env.development.local` | ローカル接続情報（Git 管理外、`npm run dev` 時のみ有効） |
