# Next.js (App Router) コーディング規約

## App Router 基本方針

- **サーバーコンポーネント優先**: データフェッチはサーバーサイドで行う
- **Client Component は最小化**: `"use client"` は インタラクション・状態管理が必要な箇所のみ
- **Server Actions**: `logout` は `app/auth/actions/index.ts` の Server Action。login/signup は対話的UX（インラインのエラー・ローディング表示）のためクライアント側で `signInWithPassword`/`signUp` を直接呼ぶ

## APIルート設計

### `app/api/comment/route.ts`

- POST メソッドのみ
- リクエスト: `{ content: string }`
- レスポンス: `{ comment, emotions, dominant, energy, insightLevel }`
- エラー時: `{ error: "メッセージ" }` + 適切なHTTPステータス
- Anthropic API は **サーバーサイドのみ**（APIキーをクライアントに露出しない）

```typescript
// APIルートの基本パターン
export async function POST(request: NextRequest) {
  try {
    const { content } = await request.json();
    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "内容が空です" }, { status: 400 });
    }
    // ... 処理 ...
    return NextResponse.json({ /* 結果 */ });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
```

生成ロジック本体は `lib/generate-comment.ts`（本番と `/try` で共有。入力長でティア判定し
`max_tokens` とコメント文字数目安を変える）。プロンプトは `prompts/system-prompt.ts`。

### `app/api/comment/demo/route.ts`

- POST メソッドのみ・**認証なし**（`/try` から呼ぶ公開ルート）
- レート制限は user_id ではなく **IP 単位**（乱用・コストのバックストップ）
- 入力上限は本番より短い（コスト抑制）

### `app/api/cron/keepalive/route.ts`

- GET・Vercel Cron（日次）から呼ばれる。Supabase の7日自動停止を防ぐ実 DB クエリ
- `Authorization: Bearer <CRON_SECRET>` の照合が**唯一のセキュリティ境界**（middleware を素通りする）
- 成功時のみ Sentry の check-in を送る（届かなければ missed で通知＝死活監視）

### `app/api/account/delete/route.ts`

- DELETE メソッド
- Supabase サービスロールキー使用（サーバーサイドのみ）
- 処理順序: entries削除 → profiles削除 → auth.deleteUser()

## Server Actions

`app/auth/actions/index.ts`：

```typescript
"use server";
// logout() のみ Server Action として定義
// login/signup は app/auth/login/page.tsx・signup/page.tsx の
// クライアント側で signInWithPassword/signUp を直接呼ぶ
// （インラインのエラー・ローディング表示のため）
// Supabase サーバークライアントを使用
```

## 認証ガード

`proxy.ts`（Next.js middleware）が全ルートを保護：

- 未認証 → `/auth/login` にリダイレクト
- 認証済みで `/auth/*` アクセス → `/` にリダイレクト
- `/admin/*` は `app/admin/layout.tsx` でサーバー側 `is_admin` チェックを追加実施

## Supabase クライアント使い分け

```typescript
// ブラウザ（Client Component）
import { createClient } from "@/lib/supabase/client";

// サーバー（Server Component / API Route / Server Action）
import { createClient } from "@/lib/supabase/server";

// 管理者操作（APIルート内のみ）
import { createAdminClient } from "@/lib/supabase/server";
```

## 型定義

`app/types.ts` に集約：

```typescript
type Emotion = { label: string; score: number };

type Entry = {
  id: string;
  content: string;
  comment: string;
  emotions: Emotion[];
  dominant: string;
  energy: number;       // 1〜10
  createdAt: string;    // ISO 8601
  insightLevel?: "deep" | "moderate" | "gentle";
  note?: string;        // 余韻メモ
  isFavorited?: boolean; // お気に入り
};
```

## コンポーネント設計

- `app/components/EmotionCalendar.tsx`: カレンダー + グラフ（Client Component）
- `app/components/EmotionChart.tsx`: 感情分布グラフ（Client Component）
- ナビゲーション: カレンダー/グラフのクリック → 記録タブの該当エントリへスクロール

## 禁止事項

- `NEXT_PUBLIC_` でない環境変数をクライアントで参照しない
- `ANTHROPIC_API_KEY` を Client Component で使用しない
- `SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_` プレフィックスで定義しない
- API ルートで認証確認なしにデータ操作しない
