import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/geist-sans.woff2",
  variable: "--font-geist-sans",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/geist-mono.woff2",
  variable: "--font-geist-mono",
  display: "swap",
  weight: "100 900",
});

const siteUrl = getSiteUrl();
const siteName = "레시담";
const description = "YouTube Shorts 속 레시피를 깔끔하게 정리하고 나만의 냉장고에 담아보세요.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "레시담 | 레시피를 담는 나만의 냉장고",
    template: "%s | 레시담",
  },
  description,
  applicationName: siteName,
  keywords: ["유튜브 쇼츠 레시피", "레시피 정리", "레시피 저장", "요리 영상 레시피"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName,
    title: "레시담 | 레시피를 담는 나만의 냉장고",
    description,
  },
  twitter: {
    card: "summary",
    title: "레시담 | 레시피를 담는 나만의 냉장고",
    description,
  },
  verification: {
    other: {
      "naver-site-verification": "f7073641283cc2f87c7b1276541e3f2b11e6307f",
    },
  },
  icons: {
    icon: "/icon.svg",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: siteName,
      url: siteUrl.origin,
      inLanguage: "ko-KR",
      description,
    },
    {
      "@type": "WebApplication",
      name: siteName,
      url: siteUrl.origin,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "ko-KR",
      description,
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
