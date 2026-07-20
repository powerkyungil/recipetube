import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "레시피 정리 가이드",
  description: "유튜브 쇼츠 레시피를 정리하고, 저장한 요리 영상을 다시 찾기 쉽게 관리하는 방법을 알아보세요.",
  alternates: {
    canonical: "/guides",
  },
  openGraph: {
    url: "/guides",
    title: "레시피 정리 가이드 | 레시담",
    description: "유튜브 쇼츠 레시피를 정리하고, 저장한 요리 영상을 다시 찾기 쉽게 관리하는 방법을 알아보세요.",
  },
};

export default function GuidesPage() {
  return (
    <main className="kitchen-grid flex-1 bg-[#f5f7ef] text-[#20352f]">
      <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <p className="text-sm font-black tracking-[0.16em] text-[#df684b]">RECIPE GUIDE</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.055em] text-[#193c33] sm:text-6xl">보고 지나친 레시피를<br />내 것으로 만드는 방법</h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-[#61766e] sm:text-lg">유튜브 쇼츠 레시피를 다시 찾기 쉽게 정리하고, 내 주방에 맞는 요리 메모로 바꾸는 방법을 소개합니다.</p>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {guides.map((guide, index) => (
            <Link key={guide.slug} href={`/guides/${guide.slug}`} className="group flex min-h-72 flex-col rounded-[28px] border border-[#dce7db] bg-white/90 p-6 shadow-[0_14px_34px_rgba(56,82,70,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(56,82,70,0.14)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f1e5] text-lg font-black text-[#397565]">0{index + 1}</span>
              <p className="mt-6 text-xs font-black tracking-[0.13em] text-[#df684b]">{guide.eyebrow}</p>
              <h2 className="mt-3 text-xl font-black tracking-[-0.04em] text-[#23483e]">{guide.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#71847c]">{guide.description}</p>
              <span className="mt-auto pt-6 text-sm font-extrabold text-[#397565]">가이드 읽기 →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
