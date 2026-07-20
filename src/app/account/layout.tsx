import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "계정 관리",
  description: "레시담 계정 정보를 관리하세요.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
