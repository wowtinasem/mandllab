import type { Metadata } from "next";
import "./globals.css";
import { themeInitScript } from "@/lib/theme";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mandllab.vercel.app";
const TITLE = "만들랩 — 말로 설명하면 진짜 쓰는 앱이 됩니다";
const DESCRIPTION = "강의 코드 하나로 입장해 AI와 대화하며 나만의 웹 앱을 만들고 HTML 파일로 가져가는 바이브코딩 실습 도구";

// 링크를 카카오톡·문자·SNS 에 공유할 때 보이는 제목·설명. 미리보기 이미지는 app/opengraph-image.png
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "만들랩",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "만들랩",
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
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
