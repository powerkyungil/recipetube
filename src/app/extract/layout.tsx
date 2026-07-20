import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Shorts 레시피 추출",
  description: "YouTube Shorts 링크를 재료와 조리 순서가 담긴 레시피로 정리하세요.",
  alternates: {
    canonical: "/extract",
  },
  openGraph: {
    url: "/extract",
    title: "YouTube Shorts 레시피 추출 | 레시담",
    description: "YouTube Shorts 링크를 재료와 조리 순서가 담긴 레시피로 정리하세요.",
  },
};

export default function ExtractLayout({ children }: { children: React.ReactNode }) {
  return children;
}
