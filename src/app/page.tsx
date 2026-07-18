import Link from "next/link";

export default function Home() {
  return (
    <main className="kitchen-grid flex-1 overflow-hidden bg-[#f5f7ef] text-[#20352f]">
      <section className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d6e6d6] bg-white/75 px-3.5 py-2 text-sm font-bold text-[#42695d] shadow-sm">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e5f0e3]">🥬</span>
            흩어진 요리 영상을 한곳에
          </div>
          <h1 className="text-[2.8rem] font-black leading-[1.1] tracking-[-0.06em] text-[#193c33] sm:text-6xl lg:text-7xl">
            보고 싶은 레시피를
            <br />
            <span className="text-[#df684b]">냉장고에 담아두세요.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-8 text-[#61766e] sm:text-lg">
            레시담은 YouTube Shorts 속 재료와 조리 순서를 알아보기 쉽게 정리하고,
            나만의 레시피 냉장고에 오래 보관해 드려요.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/extract" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#397565] px-6 font-extrabold text-white shadow-[0_10px_24px_rgba(57,117,101,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2f6557]">
              레시피 추출하기
              <ArrowIcon className="h-5 w-5" />
            </Link>
            <Link href="/fridge" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#cad8ce] bg-white/80 px-6 font-extrabold text-[#3c6257] transition hover:-translate-y-0.5 hover:bg-white">
              나의 냉장고 보기
            </Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#71847c]">
            <span className="flex items-center gap-2"><CheckIcon /> 재료 자동 정리</span>
            <span className="flex items-center gap-2"><CheckIcon /> 조리 순서 요약</span>
            <span className="flex items-center gap-2"><CheckIcon /> 레시피 저장</span>
          </div>
        </div>

        <FridgeIllustration />
      </section>

      <section className="border-y border-[#e1e9df] bg-white/65">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
          <div className="text-center">
            <p className="text-sm font-black tracking-[0.16em] text-[#df684b]">HOW IT WORKS</p>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#23483e] sm:text-4xl">세 단계면 충분해요</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <StepCard number="01" emoji="🔗" title="Shorts 링크 붙이기" description="마음에 든 요리 영상의 주소를 복사해 넣어요." />
            <StepCard number="02" emoji="🥣" title="레시피로 정리하기" description="재료와 계량, 조리 순서를 한눈에 정리해요." />
            <StepCard number="03" emoji="🧊" title="냉장고에 보관하기" description="로그인하고 나중에 다시 보고 싶은 레시피를 담아요." />
          </div>
        </div>
      </section>
    </main>
  );
}

function FridgeIllustration() {
  return (
    <div className="relative mx-auto w-full max-w-[470px] px-7 py-5 sm:px-12">
      <div className="absolute -left-3 top-20 h-28 w-28 rounded-full bg-[#f6cfaa]/55 blur-2xl" />
      <div className="absolute -right-4 bottom-16 h-36 w-36 rounded-full bg-[#bcded3]/70 blur-2xl" />
      <div className="fridge-shine relative rounded-[44px] border-[7px] border-white/80 bg-[#cfe6df] p-4 shadow-[0_30px_70px_rgba(46,83,71,0.22)]">
        <div className="relative z-10 rounded-[30px] border border-white/80 bg-[#eaf5f0] p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-[#c6d9d0] pb-5">
            <div>
              <p className="text-xs font-bold text-[#789087]">MY RECIPE FRIDGE</p>
              <p className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#315f52]">나의 냉장고</p>
            </div>
            <span className="h-3 w-3 rounded-full bg-[#74ac74] ring-4 ring-[#dcebd9]" />
          </div>
          <div className="space-y-3 py-5">
            <RecipeMagnet emoji="🍝" color="bg-[#fff2e8]" title="토마토 원팬 파스타" meta="20분 · 쉬움" />
            <RecipeMagnet emoji="🥘" color="bg-[#fff8d9]" title="매콤달콤 제육볶음" meta="25분 · 쉬움" />
            <RecipeMagnet emoji="🥗" color="bg-[#eaf4e5]" title="두부 들깨 샐러드" meta="10분 · 아주 쉬움" />
          </div>
          <div className="rounded-2xl border border-dashed border-[#aac6ba] bg-white/55 px-4 py-3 text-center text-sm font-bold text-[#668279]">새로운 레시피를 기다리고 있어요</div>
        </div>
        <div className="relative z-10 mx-auto mt-3 h-2 w-28 rounded-full bg-[#6f9d8e]/65" />
      </div>
      <div className="gentle-float absolute -right-1 top-0 rotate-3 rounded-2xl border border-[#efdda5] bg-[#fff6c9] px-4 py-3 text-sm font-extrabold text-[#765f2c] shadow-lg">오늘 뭐 먹지? 🥕</div>
    </div>
  );
}

function RecipeMagnet({ emoji, color, title, meta }: { emoji: string; color: string; title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white bg-white/85 p-3 shadow-sm">
      <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${color}`}>{emoji}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-extrabold text-[#34564c]">{title}</span>
        <span className="mt-0.5 block text-xs font-medium text-[#87978f]">{meta}</span>
      </span>
    </div>
  );
}

function StepCard({ number, emoji, title, description }: { number: string; emoji: string; title: string; description: string }) {
  return (
    <article className="rounded-[24px] border border-[#e0e8de] bg-white p-6 shadow-[0_10px_30px_rgba(48,73,62,0.06)]">
      <div className="flex items-center justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f0f5ed] text-2xl">{emoji}</span>
        <span className="text-sm font-black tracking-[0.12em] text-[#e27a60]">STEP {number}</span>
      </div>
      <h3 className="mt-5 text-lg font-extrabold text-[#294c42]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#75877f]">{description}</p>
    </article>
  );
}

function CheckIcon() {
  return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#dcebd9] text-xs text-[#397565]">✓</span>;
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  );
}
