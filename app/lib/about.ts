// 凪の紹介文とサブタイトル（複数画面で共用）

// ロゴ下のサブタイトル。認証まわりの各ページ・/try・アプリ内ヘッダーで使う。
// v1.88.0 以前は各ファイルに「Nagi · 自己観察の記録」を直書きしていた。
export const APP_SUBTITLE = "Nagi · 波が凪ぐところ";

export const ABOUT_INTRO =
  "凪は、出来事の良し悪しを決めません。あなたが書いたことばを静かに受けとり、そこにある気持ちをそっと言葉にして返します。書きたいときだけ、開いてください。";

export const ABOUT_FIRST_STEP =
  "画面上部の入力欄に、今日のことを少しだけ書いてみてください。うまく言葉にならなくても、そのままで大丈夫です。記録すると、凪からことばが届きます。";

// 登録前に「ほかの利用者からは見えない」ことを示す一行（/try の登録CTA・登録画面で共用）。
//
// 根拠は entries の RLS `using (auth.uid() = user_id or public.is_admin())`
//（docs/supabase-setup.sql）。**他ユーザーからの不可視だけが保証される**。
// 「ほかの誰にも見えません」とは書けない：
//   ① 運営者は SUPABASE_SERVICE_ROLE_KEY と Supabase ダッシュボードを持ち、
//      service_role は RLS を完全にバイパスする（DB 側の設定では塞げない）。
//      加えて is_admin=true のアカウントは entries の RLS `or public.is_admin()` により、
//      service_role キー無しの通常セッションからも全ユーザーの本文を SELECT できる
//      （v1.89.0 で「アプリが取得しなくなった」だけで、DB 権限は残っている）
//   ② 本文は AI コメント生成のため Anthropic に送信される（app/privacy/page.tsx 4章）
// v1.89.0 で管理ダッシュボードは admin_entry_stats ビュー経由の文字数だけを読むようになり、
// アプリの経路からは本文が消えたが、①②は残るため**この文言は強められない**。
// 運営者アクセスの範囲は app/privacy/page.tsx 6章で開示している。
export const PRIVACY_ASSURANCE =
  "書いた記録は、あなただけのものです。ほかの利用者に見られることはありません。";
