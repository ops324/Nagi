# /project:review — Nagi コードレビュー

Nagiプロジェクトのコードを4つの専門視点から並列レビューする。

## 実行手順

### 1. 変更ファイルの検出

```bash
git diff --name-only HEAD
git diff --name-only --cached
```

ステージ済み・未ステージ両方の変更ファイルを取得する。変更がない場合は直近コミットとの差分（`git diff HEAD~1 --name-only`）を対象にする。

### 2. 4エージェントの並列レビュー

以下の4エージェントを**同時に**起動し、各専門領域でレビューを実施する。

---

#### エージェント①：セキュリティレビュー

**参照ルール：** `.claude/rules/security.md`

以下の観点でコードを検査する：

- `ANTHROPIC_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` がクライアントコードに露出していないか
- `NEXT_PUBLIC_` でない環境変数をブラウザ側で参照していないか
- `createAdminClient` が `app/api/account/delete/route.ts` 以外で使われていないか
- 認証なしのデータ操作（RLSバイパス）がないか
- `dangerouslySetInnerHTML` の使用がないか
- 入力バリデーション（空文字・型チェック）が実装されているか

---

#### エージェント②：アーキテクチャ・Next.js レビュー

**参照ルール：** `.claude/rules/nextjs.md` / `.claude/rules/architecture.md`

以下の観点でコードを検査する：

- `"use client"` が不必要に使われていないか（サーバーコンポーネントで十分な箇所）
- データフェッチがサーバーサイドで行われているか
- Server Actions が `app/auth/actions/index.ts` に集約されているか
- コンポーネントのファイル名が PascalCase になっているか
- APIルートのレスポンス形式が規約通りか（`{ error }` + HTTPステータス）
- `app/types.ts` への型集約が守られているか

---

#### エージェント③：Supabase・DB レビュー

**参照ルール：** `.claude/rules/supabase.md`

以下の観点でコードを検査する：

- DBから取得したデータの snake_case → camelCase 変換が明示的に行われているか
- INSERT 時に camelCase → snake_case で渡しているか
- RLS ポリシーを無効化するコードがないか
- `createAdminClient` がページ・Client Component で使われていないか
- テーブル変更時に `docs/supabase-setup.sql` と `docs/仕様書.md` が更新されているか

---

#### エージェント④：AI品質レビュー

**参照ルール：** `.claude/rules/ai-comment.md`

以下の観点でコードを検査する：

- `prompts/system-prompt.ts` の出力フォーマットに必須フィールドが揃っているか（`comment` / `emotions` / `dominant` / `energy` / `insight_level`）
- `route.ts` の APIレスポンスに `insightLevel` が含まれているか
- `app/types.ts` の `Entry` 型が APIレスポンスと一致しているか
- `insight_level` の3段階（`deep` / `moderate` / `gentle`）が正しく判定・保存・表示されているか
- AIモデルが `claude-haiku-4-5-20251001`、`max_tokens` が 800 になっているか

---

### 3. 結果の統合報告

各エージェントの結果を以下の形式でまとめて報告する。

```
## Nagi コードレビュー結果

### 🔴 must（必ず修正）
- [エージェント名] 指摘内容・該当ファイル・行番号

### 🟡 imo（できれば修正）
- [エージェント名] 指摘内容・該当ファイル

### 🔵 nits（細かい改善提案）
- [エージェント名] 指摘内容

### ✅ 問題なし
- [エージェント名] チェック済み項目
```

**判定基準：**
- `must`：セキュリティリスク・型不一致・データ損失の可能性・ビルドエラー
- `imo`：規約違反・可読性の問題・将来的なバグリスク
- `nits`：命名の一貫性・コメント不足・軽微なスタイル
