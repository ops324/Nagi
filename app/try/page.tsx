import type { Metadata } from "next";
import ThemeManager from "@/app/components/ThemeManager";
import DemoClient from "./DemoClient";

export const metadata: Metadata = {
  title: "凪を試す · Nagi",
  description: "登録のまえに、一度だけ凪にことばを渡してみてください。",
};

// 登録前のお試し体験ページ（公開ルート）。
// 認証もデータ取得もせず、DemoClient で「書く → 凪の応答 → 登録CTA」を完結させる。
export default function TryPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
      <ThemeManager />
      <DemoClient />
    </main>
  );
}
