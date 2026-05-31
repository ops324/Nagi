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

## E2E テスト（Playwright）

ローカル環境で「ログイン → ホーム遷移 → サンプル記録表示 → AI コメント生成 → 管理者ダッシュボード」までを
自動で検証する Playwright テストを用意している（`tests/e2e/`）。

### 前提
- `npm run db:start` でローカル Supabase が起動済み
- `.env.development.local` が設定済み（手順は上記）
- `.env.local` に `ANTHROPIC_API_KEY` が入っていること（AI コメントテスト用）

### 実行

```bash
npm run test:e2e           # 3 テスト全て実行（Anthropic API を 1 回呼ぶ）
npm run test:e2e:no-ai     # AI コメントテストをスキップ（API 消費なし）
npm run test:e2e:ui        # Playwright UI モードでデバッグ
```

実行内容：
- `globalSetup` が `supabase db reset` を 1 回実行し、シード状態に戻す
- Playwright が `npx next dev -p 3100` を自動起動（既存サーバーがあれば再利用）
- 3 シナリオを順次実行（DB 共有のため fullyParallel=false）

| ファイル | 検証内容 |
|----------|----------|
| `tests/e2e/login.spec.ts` | dev@nagi.local でログイン → `/` 遷移 → サンプル記録 3 件表示 |
| `tests/e2e/ai-comment.spec.ts` | 新規記録投稿 → `/api/comment` 200 → 凪のコメント描画 |
| `tests/e2e/admin.spec.ts` | admin@nagi.local でログイン → `/admin` ダッシュボード表示 |

### ポート 3100 について
`playwright.config.ts` の `webServer` は **ポート 3100** で dev サーバーを起動する
（Claude Desktop が 3000 を使うことがあるため衝突回避）。
`lib/origin-check.ts` の `ALLOWED_ORIGINS` に `http://localhost:3100` を追加済み。

### 失敗時のデバッグ
- `test-results/<test-name>/` にスクリーンショット・trace.zip が保存される
- `npx playwright show-trace test-results/<test-name>/trace.zip` で操作トレースを開ける

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
| E2E テストで AI コメントだけ 500 になる | 親シェルに `ANTHROPIC_API_KEY` が設定されていると `.env.local` の値を shadow する。`playwright.config.ts` の `webServer.command` で `unset` してから起動しているので通常は問題なし。手動で `npm run dev` を起動して E2E を回す場合は `unset ANTHROPIC_API_KEY` してから起動する |

## 関連ファイル

| パス | 役割 |
|------|------|
| `supabase/config.toml` | ポート・project_id・Auth 設定 |
| `supabase/migrations/20260601000000_initial_schema.sql` | 初期スキーマ（profiles / entries / RLS / 関数等） |
| `supabase/seed.sql` | テストユーザー＋サンプル entries |
| `docs/supabase-setup.sql` | 本番用累積 SQL（従来運用、当面併存） |
| `.env.local` | 本番接続情報（Git 管理外） |
| `.env.development.local` | ローカル接続情報（Git 管理外、`npm run dev` 時のみ有効） |
