import type { Metadata } from "next";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "만들랩 — 말로 만드는 나의 웹 앱",
  description: "강의 코드 하나로 입장해 AI와 대화하며 실제로 쓰는 웹 앱을 만드는 바이브코딩 메이커 도구",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 테마는 브라우저에서 바로 적용되므로 서버 HTML 과 data-theme 이 달라도 경고하지 않는다
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
