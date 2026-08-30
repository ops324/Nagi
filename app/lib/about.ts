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
//   ① 管理者は is_admin() バイパスで全ユーザーの本文を SELECT できる
//      （app/admin/page.tsx が実際に content を取得している）
//   ② 本文は AI コメント生成のため Anthropic に送信される（app/privacy/page.tsx 4章）
// この文言を強める場合は、上の2点を先に解消すること。
export const PRIVACY_ASSURANCE =
  "書いた記録は、あなただけのものです。ほかの利用者に見られることはありません。";
