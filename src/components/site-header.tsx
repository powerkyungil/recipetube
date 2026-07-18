"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "메인" },
  { href: "/fridge", label: "나의 냉장고" },
  { href: "/extract", label: "레시피 추출" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[#dfe7dd] bg-[#f8faf4]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="레시담 메인으로 이동">
          <span className="fridge-shine flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#397565] text-white shadow-[0_6px_18px_rgba(45,94,80,0.18)]">
            <FridgeLogoIcon className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xl font-black tracking-[-0.05em] text-[#214a40]">레시담</span>
            <span className="hidden text-[10px] font-medium text-[#7d8e87] sm:block">레시피를 담는 나만의 냉장고</span>
          </span>
        </Link>

        <nav aria-label="주요 메뉴" className="flex items-center gap-1 rounded-2xl bg-[#edf3eb] p-1">
          {navigation.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-xl px-2.5 py-2 text-xs font-bold transition sm:px-4 sm:text-sm ${
                  active
                    ? "bg-white text-[#2f6658] shadow-sm"
                    : "text-[#74867f] hover:bg-white/60 hover:text-[#3c5d53]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function FridgeLogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M5 10h14M8 6.5v1.5M8 13.5v2.5M8 21.5v1M16 21.5v1" />
    </svg>
  );
}
