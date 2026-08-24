"use client";

import { useId } from "react";
import Link from "next/link";
import { spawnRipple } from "../lib/ripple";

// 登録前のお試し体験（/try）への導線。ログイン画面・登録画面の両方から使う。
//
// v1.85.0: 旧実装は各画面の最下部に置いた 12px のテキストリンク1本
//（「登録のまえに、凪を試してみる」）で、他のリンクに埋もれ新規ユーザーが
// 入口に気づけなかった。ログイン/登録の primary ボタンと競合させないまま
// 見つかるよう、輪郭のある二次ボタンへ格上げする（面は塗らず、緑の細い輪郭のみ）。
// 文言は /try 本体（「ここで書いたことばは保存されません。登録のまえに、一度だけ試してみてください。」）
// と同じ「登録のまえに」の語りに揃える。登録フォームの直下に置く登録画面でも、
// 進行中の行為を否定せずに済む。
//
// 輪郭は緑（--green）1px。凪のパレットでは緑が淡いため輪郭単体の対背景コントラストは
// ライト時 約1.4:1（primary の緑ベタボタンと同水準）で WCAG 1.4.11 の 3:1 には届かないが、
// ボタンの識別はラベル文字（--text-primary＝約9:1）が担う。ハウススタイル（淡い緑）を
// 崩さずに存在感を上げるため、混色をやめて --green をそのまま使う。
//
// 背景色をインラインで指定しないのは、.btn-ghost の hover/press（state layer）が
// background-color で表現されるため。インライン指定は class より優先され、
// 触れたときの反応が消えてしまう。
export default function TryCta() {
  const noteId = useId();

  return (
    <div className="mt-8">
      {/* 「持っている人の導線」と「まだ持っていない人の導線」を分ける静かな区切り */}
      <div className="mx-auto mb-6 h-px w-16" style={{ backgroundColor: "var(--border)" }} />

      <Link
        href="/try"
        onPointerDown={spawnRipple}
        aria-describedby={noteId}
        className="btn-ghost block w-full py-3 rounded-full text-xs tracking-widest text-center"
        style={{
          border: "1px solid var(--green)",
          color: "var(--text-primary)",
          // globals.css の `a:focus-visible { border-radius: 6px }` は未レイヤーのため
          // Tailwind の `rounded-full`（@layer utilities）に勝つ。フォーカス時だけ
          // pill が角丸長方形に化けるのを、class より強いインライン指定で防ぐ。
          borderRadius: "9999px",
        }}
      >
        登録のまえに、凪をお試し
      </Link>

      {/* 補足は「回数の上限」ではなく「保存されない」という事実を伝える。
          /try は公開ルートでリロードすれば再入力でき（DemoClient は使用済みフラグを持たない）、
          実際の上限は /api/comment/demo の IP あたり 5回/時。「1回だけ」と書くと実装と食い違う。 */}
      <p id={noteId} className="text-center text-xs mt-3" style={{ color: "var(--text-muted)" }}>
        登録は不要です。書いたことばは保存されません
      </p>
    </div>
  );
}
