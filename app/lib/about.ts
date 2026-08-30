import type { CSSProperties } from "react";

// 凪の紹介文とサブタイトル（複数画面で共用）

// ロゴ下のサブタイトル。ログイン・登録・パスワード再設定2面・/try・アプリ内ヘッダーの
// 6箇所で使う。v1.88.0 以前は各ファイルに「Nagi · 自己観察の記録」を直書きしていた。
export const APP_SUBTITLE = "Nagi · 波が凪ぐところ";

export const ABOUT_INTRO =
  "凪は、出来事の良し悪しを決めません。あなたが書いたことばを静かに受けとり、そこにある気持ちをそっと言葉にして返します。書きたいときだけ、開いてください。";

export const ABOUT_FIRST_STEP =
  "画面上部の入力欄に、今日のことを少しだけ書いてみてください。うまく言葉にならなくても、そのままで大丈夫です。記録すると、凪からことばが届きます。";

// 登録前に「誰にも読まれない」ことを示す一行（/try の登録CTA・登録画面で共用）。
// 実装上の根拠は Supabase の RLS（entries は auth.uid() = user_id のみ）。
export const PRIVACY_ASSURANCE =
  "書いた記録は、あなただけのものです。ほかの誰にも見えません。";

// 日本語の折り返しを文節境界にする（v1.88.0）。既定では「開いてくださ／い。」のように
// 行末に1文字だけ残り、text-wrap: balance では「そっと言／葉」と語中で切れる。
// globals.css に書くと Tailwind v4 の Lightning CSS が未知の値としてルートごと削除する
// ため、インラインスタイルとして配る。未対応ブラウザ（Safari＝要確認）は既定の
// 折り返しにフォールバックするだけで、レイアウトは壊れない。
export const JP_PHRASE_WRAP = { wordBreak: "auto-phrase" } as CSSProperties;
