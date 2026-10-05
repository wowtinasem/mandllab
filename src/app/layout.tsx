import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "만들랩 — 말로 만드는 나의 웹 앱",
  description: "강의 코드 하나로 입장해 AI와 대화하며 실제로 쓰는 웹 앱을 만드는 바이브코딩 메이커 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
