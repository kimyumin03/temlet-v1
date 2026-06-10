import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "axhub × Next.js",
  description: "조코딩 AX 파트너스 axhub 위에서 굴러가는 Next.js 바이브코딩 템플릿",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard — axhub 디자인 시스템 기본 폰트 (CDN) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
