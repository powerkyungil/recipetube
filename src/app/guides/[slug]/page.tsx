import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGuide, guides } from "@/lib/guides";
import { getSiteUrl } from "@/lib/site-url";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    return {};
  }

  const url = `/guides/${guide.slug}`;

  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      url,
      title: `${guide.title} | 레시담`,
      description: guide.description,
      type: "article",
    },
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    notFound();
  }

  const url = new URL(`/guides/${guide.slug}`, getSiteUrl()).toString();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    inLanguage: "ko-KR",
    mainEntityOfPage: url,
    author: {
      "@type": "Organization",
      name: "레시담",
    },
    publisher: {
      "@type": "Organization",
      name: "레시담",
    },
  };

  return (
    <main className="kitchen-grid flex-1 bg-[#f5f7ef] text-[#20352f]">
      <article className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <Link href="/guides" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#53786d] transition hover:text-[#2f6557]">← 레시피 정리 가이드</Link>
        <header className="mt-10 rounded-[32px] border border-[#dce7db] bg-white/90 px-6 py-9 shadow-[0_16px_40px_rgba(56,82,70,0.08)] sm:px-10 sm:py-12">
          <div className="flex flex-wrap items-center gap-3 text-xs font-black tracking-[0.12em] text-[#df684b]">
            <span>{guide.eyebrow}</span>
            <span className="h-1 w-1 rounded-full bg-[#b1c2b8]" />
            <span className="text-[#71847c]">{guide.readingTime}</span>
          </div>
          <h1 className="mt-5 text-4xl font-black leading-[1.15] tracking-[-0.055em] text-[#193c33] sm:text-5xl">{guide.title}</h1>
          <p className="mt-6 text-base leading-8 text-[#61766e] sm:text-lg">{guide.intro}</p>
        </header>

        <div className="mt-10 space-y-10">
          {guide.sections.map((section, index) => (
            <section key={section.heading} className="rounded-[28px] border border-[#e1e9df] bg-white/75 p-6 sm:p-8">
              <p className="text-sm font-black tracking-[0.12em] text-[#df684b]">STEP {index + 1}</p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#23483e]">{section.heading}</h2>
              <div className="mt-5 space-y-4 text-base leading-8 text-[#596f66]">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              {section.bullets ? (
                <ul className="mt-6 space-y-3 rounded-2xl bg-[#eef5ec] p-5 text-sm font-semibold leading-6 text-[#47675d]">
                  {section.bullets.map((bullet) => <li key={bullet} className="flex gap-3"><span aria-hidden="true" className="text-[#df684b]">✓</span><span>{bullet}</span></li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <section className="mt-10 rounded-[28px] border border-[#d6e6d6] bg-[#e8f1e5] p-6 sm:p-8">
          <p className="text-sm font-black tracking-[0.12em] text-[#df684b]">FAQ</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#23483e]">자주 묻는 질문</h2>
          <div className="mt-6 space-y-5">
            {guide.faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-white/80 bg-white/75 p-5">
                <h3 className="font-extrabold text-[#2d564a]">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-[#61766e]">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[28px] bg-[#397565] p-7 text-white shadow-[0_16px_36px_rgba(57,117,101,0.22)] sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-9">
          <div>
            <p className="text-sm font-black tracking-[0.12em] text-[#dcebd9]">TRY RECIDAM</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.04em]">마음에 든 쇼츠 레시피를 정리해 보세요.</h2>
            <p className="mt-3 text-sm leading-6 text-[#e3f0ea]">링크를 붙여 넣고 재료와 조리 순서를 확인한 뒤, 내 냉장고에 저장할 수 있어요.</p>
          </div>
          <Link href="/extract" className="mt-6 inline-flex min-h-12 shrink-0 items-center justify-center rounded-2xl bg-white px-5 font-extrabold text-[#397565] transition hover:-translate-y-0.5 hover:bg-[#f6fbf5] sm:mt-0">레시피 추출하기 →</Link>
        </section>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    </main>
  );
}
