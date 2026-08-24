import type { Metadata } from "next";
import DemoClient from "./DemoClient";

export const metadata: Metadata = {
  title: "凪を試す · Nagi",
  description: "登録のまえに、一度だけ凪にことばを渡してみてください。",
};

// 登録前のお試し体験ページ（公開ルート）。
// 認証もデータ取得もせず、DemoClient で「書く → 凪の応答 → 登録CTA」を完結させる。
// テーマ（ThemeManager）は root layout が全ルートに描画するため、ここでは持たない
// （v1.86.0 で二重描画を解消。以前は setInterval と太陽計算が2本走っていた）。
export default function TryPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <DemoClient />
    </main>
  );
}
