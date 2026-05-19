import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Zen_Old_Mincho, Noto_Serif_JP } from "next/font/google";
import "./globals.css";
import ThemeManager from "./components/ThemeManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 記録本文用の明朝（凪の世界観の中核）
const zenOldMincho = Zen_Old_Mincho({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-zen-old-mincho",
  display: "swap",
});

// 凪のことば用の明朝
const notoSerifJP = Noto_Serif_JP({
  weight: ["300", "400", "500"],
  subsets: ["latin"],
  variable: "--font-noto-serif-jp",
  display: "swap",
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
        className={`${geistSans.variable} ${geistMono.variable} ${zenOldMincho.variable} ${notoSerifJP.variable} antialiased`}
      >
        <ThemeManager />
        {children}
      </body>
    </html>
  );
}
