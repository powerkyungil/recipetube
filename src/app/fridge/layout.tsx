import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "나의 냉장고 | 레시담",
  description: "내가 저장한 레시피를 한곳에서 확인하세요.",
};

export default function FridgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
