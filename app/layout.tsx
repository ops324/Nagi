import type { Metadata, Viewport } from "next";
import { Zen_Old_Mincho, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import ThemeManager from "./components/ThemeManager";

// 記録本文用の明朝（凪の世界観の中核）
// weight は実使用ぶん（400）のみ。preload:false で初回ネットワーク競合を避け、
// display:"swap" で fallback(Hiragino Mincho) を即表示しつつ後から差し替える。
const zenOldMincho = Zen_Old_Mincho({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-zen-old-mincho",
  display: "swap",
  preload: false,
});

// 凪のことば用の明朝（実使用は 300/400 のみ）
const notoSerifJP = Noto_Serif_JP({
  weight: ["300", "400"],
  subsets: ["latin"],
  variable: "--font-noto-serif-jp",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Nagi",
  description: "静かな自己観察の記録アプリ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nagi",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)",  color: "#1a1816" },
  ],
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${zenOldMincho.variable} ${notoSerifJP.variable} antialiased`}
      >
        <ThemeManager />
        {children}
      </body>
    </html>
  );
}
