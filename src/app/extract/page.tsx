"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createMockRecipeResponse } from "@/lib/mock-recipe";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type {
  ExtractRecipeResponse,
  Recipe,
  UsageStatusResponse,
} from "@/types/recipe";

const GUEST_DEMO_RESULT = createMockRecipeResponse({
  url: "https://youtube.com/shorts/demo",
  canonicalUrl: "https://www.youtube.com/shorts/demo",
  videoId: "demo",
  usage: { limit: 10, used: 0, remaining: 10, subject: "anonymous" },
  isDemo: true,
});

type LoginNotice = {
  tone: "success" | "error";
  text: string;
};

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [usage, setUsage] = useState<ExtractRecipeResponse["usage"] | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [result, setResult] = useState<ExtractRecipeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<LoginNotice | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);

      if (!nextSession) {
        setResult(null);
        setUsage(null);
      } else {
        setLoginNotice(null);
      }
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const accessToken = session?.access_token;

    if (!authReady) {
      return;
    }

    if (!accessToken) {
      return;
    }

    const controller = new AbortController();

    async function loadUsage() {
      setUsageLoading(true);

      try {
        const response = await fetch("/api/recipes/extract", {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        const data = (await response.json()) as UsageStatusResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "사용량을 불러오지 못했습니다.");
        }

        setUsage(data.usage);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setMessage(
          error instanceof Error
            ? error.message
            : "사용량을 불러오지 못했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setUsageLoading(false);
        }
      }
    }

    void loadUsage();
    return () => controller.abort();
  }, [authReady, session?.access_token]);

  async function extractRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.access_token) {
      setMessage("레시피 추출은 로그인 후 이용할 수 있어요. 아래 예시 결과를 먼저 확인해 보세요.");
      return;
    }

    if (!usage || usage.remaining <= 0) {
      setMessage("이번 달 무료 추출 10회를 모두 사용했습니다. 다음 달 1일에 다시 이용할 수 있어요.");
      return;
    }

    setLoading(true);
    setMessage(null);
    setResult(null);

    try {
      const response = await fetch("/api/recipes/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "레시피를 추출하지 못했습니다.");
      }

      const extractionResult = data as ExtractRecipeResponse;
      setResult(extractionResult);
      setUsage(extractionResult.usage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginNotice(null);

    if (!supabase) {
      setLoginNotice({
        tone: "error",
        text: "로그인 이메일 서비스를 사용할 수 없습니다.",
      });
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/extract",
      },
    });

    setLoginNotice(
      error
        ? { tone: "error", text: formatLoginError(error.message) }
        : {
            tone: "success",
            text: "로그인 링크를 이메일로 보냈어요. 메일함을 확인해 주세요.",
          },
    );
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setResult(null);
    setUsage(null);
    setLoginNotice(null);
  }

  async function saveRecipe(recipe: Recipe) {
    if (!result || !session?.access_token) {
      setMessage("저장하려면 로그인이 필요합니다.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/recipes/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sourceUrl: result.source.canonicalUrl,
          title: recipe.title,
          recipe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "저장하지 못했습니다.");
      }

      setMessage("레시피를 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const guestDemo = authReady && !session;
  const displayedResult = result ?? (guestDemo ? GUEST_DEMO_RESULT : null);
  const canExtract = Boolean(
    authReady &&
      session &&
      usage &&
      usage.remaining > 0 &&
      !usageLoading,
  );

  return (
    <main className="kitchen-grid flex-1 bg-[#f5f7ef] text-[#20352f]">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="pb-9 lg:pb-10">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e4efe1] px-3 py-1.5 text-sm font-bold text-[#3b6659]">
              <span className="h-2 w-2 rounded-full bg-[#ef7d5e]" />
              레시피 추출
            </div>
            <h1 className="text-[2.5rem] font-black leading-[1.15] tracking-[-0.05em] text-[#193c33] sm:text-5xl">
              쇼츠 링크를 <span className="text-[#e06245]">레시피로</span> 바꿔볼까요?
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#60736c]">
              지나치기 아까운 YouTube Shorts 요리 영상을 붙여 넣으세요.
              재료부터 조리 순서까지 보기 좋게 정리해 드려요.
            </p>
          </div>
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <section className="rounded-[28px] border border-[#d9e3da] bg-white p-5 shadow-[0_20px_60px_rgba(48,73,62,0.10)] sm:p-8">
            <div className="mb-7 flex items-center gap-3 border-b border-[#edf1eb] pb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0e9] text-[#de684c]">
                <PlayIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-[-0.02em]">새 레시피 담기</h2>
                <p className="text-sm text-[#7a8a84]">마음에 든 Shorts 링크를 알려주세요</p>
              </div>
            </div>

            <form className="flex flex-col gap-4" onSubmit={extractRecipe}>
              <label className="text-sm font-bold text-[#38544b]" htmlFor="url">
                YouTube Shorts 주소
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                  <LinkIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#91a099]" />
                  <input
                    id="url"
                    type="url"
                    disabled={!canExtract}
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://youtube.com/shorts/..."
                    className="min-h-14 w-full rounded-2xl border border-[#d7e0d7] bg-[#fafcf8] py-3 pl-12 pr-4 text-base outline-none transition placeholder:text-[#a8b3ae] focus:border-[#4d8878] focus:bg-white focus:ring-4 focus:ring-[#dcece7] disabled:cursor-not-allowed disabled:bg-[#f0f3ef] disabled:text-[#99a59f]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !url || !canExtract}
                  className="min-h-14 rounded-2xl bg-[#397565] px-6 font-bold text-white shadow-[0_8px_20px_rgba(57,117,101,0.22)] transition hover:-translate-y-0.5 hover:bg-[#2f6557] disabled:cursor-not-allowed disabled:bg-[#a7b7b0] disabled:shadow-none disabled:hover:translate-y-0"
                >
                  {!authReady || usageLoading
                    ? "이용 정보 확인 중..."
                    : !session
                      ? "로그인 후 이용"
                      : usage?.remaining === 0
                        ? "이번 달 10회 사용 완료"
                        : loading
                          ? "레시피 정리 중..."
                          : "레시피 추출하기"}
                </button>
              </div>
              <p className="flex items-start gap-2 text-sm leading-6 text-[#7a8a84]">
                <InfoIcon className="mt-1 h-4 w-4 shrink-0" />
                현재 `/shorts/영상ID` 형식의 링크만 정리할 수 있어요.
              </p>
            </form>

            {guestDemo ? (
              <div className="mt-5 rounded-2xl border border-[#efd7b6] bg-[#fff8e9] px-4 py-3 text-sm leading-6 text-[#7c6033]">
                <p className="font-extrabold">비로그인 상태에서는 실제 영상을 추출하지 않아요.</p>
                <p className="mt-0.5">아래 체험용 예시로 결과 형태를 확인한 뒤, 로그인하면 매월 10회 이용할 수 있어요.</p>
              </div>
            ) : null}

            {message ? (
              <div aria-live="polite" className="mt-5 rounded-2xl border border-[#f0d5b7] bg-[#fff8ec] px-4 py-3 text-sm font-medium text-[#805526]">
                {message}
              </div>
            ) : null}

            {displayedResult ? (
              <RecipeResult
                data={displayedResult}
                onSave={() => saveRecipe(displayedResult.recipe)}
                canSave={Boolean(session && result)}
                saving={saving}
              />
            ) : (
              <div className="mt-8 grid gap-3 border-t border-[#edf1eb] pt-7 sm:grid-cols-3">
                <FeatureStep icon={<LinkIcon className="h-5 w-5" />} number="01" title="링크 붙이기" description="Shorts 주소를 복사해요" />
                <FeatureStep icon={<SpoonIcon className="h-5 w-5" />} number="02" title="레시피 정리" description="재료와 순서를 찾아요" />
                <FeatureStep icon={<FridgeIcon className="h-5 w-5" />} number="03" title="냉장고에 저장" description="언제든 다시 꺼내봐요" />
              </div>
            )}
          </section>

          <aside className="fridge-shine rounded-[28px] bg-[#cfe4dd] p-2 shadow-[0_20px_50px_rgba(52,93,80,0.14)]">
            <div className="relative z-10 rounded-[22px] border border-white/70 bg-[#edf6f1]/90 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#397565] text-white shadow-sm">
                    <FridgeIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold">나의 냉장고</h2>
                    <p className="text-xs font-medium text-[#71857d]">소중한 레시피 보관함</p>
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-[#79ad78] ring-4 ring-[#dfeedd]" />
              </div>

              <div className="my-6 h-px bg-[#cfddd4]" />

              {session?.user.email ? (
                <div className="flex flex-col gap-3 text-sm">
                  <p className="truncate rounded-xl bg-white/80 px-3 py-3 font-medium text-[#466058]">{session.user.email}</p>
                  <UsageMeter usage={usage} loading={usageLoading} />
                  <button type="button" onClick={signOut} className="min-h-11 rounded-xl border border-[#bfd0c5] bg-white/70 px-4 font-bold text-[#466058] transition hover:bg-white">
                    로그아웃
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-3" onSubmit={sendMagicLink}>
                  <label htmlFor="email" className="text-sm font-bold text-[#466058]">로그인하고 월 10회 이용하기</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    className="min-h-12 rounded-xl border border-[#c4d3c9] bg-white/80 px-3 outline-none transition placeholder:text-[#9caaa4] focus:border-[#4d8878] focus:bg-white focus:ring-4 focus:ring-white/70"
                  />
                  <button type="submit" className="min-h-11 rounded-xl bg-[#e36f50] px-4 font-bold text-white shadow-[0_7px_16px_rgba(211,96,68,0.18)] transition hover:bg-[#cf5e42]">
                    이메일로 로그인
                  </button>
                  {loginNotice ? (
                    <div
                      aria-live="polite"
                      className={`rounded-xl border px-3.5 py-3 text-xs font-bold leading-5 ${
                        loginNotice.tone === "error"
                          ? "border-[#edcdbd] bg-[#fff5ef] text-[#9a5c47]"
                          : "border-[#c7ddd2] bg-white/75 text-[#3f6b5d]"
                      }`}
                    >
                      {loginNotice.text}
                    </div>
                  ) : null}
                </form>
              )}

              <div className="mt-6 rotate-[-1deg] rounded-2xl border border-[#efdda5] bg-[#fff6c9] p-4 text-sm text-[#735f31] shadow-sm">
                <p className="mb-2 font-extrabold">냉장고 이용 안내</p>
                <div className="space-y-1 text-xs leading-5">
                  <p>비로그인 · 실제 추출 불가, 예시 결과 미리보기</p>
                  <p>무료회원 · 매월 10번 추출, 무제한 저장</p>
                  <p>사용 횟수 · 매월 1일 자동 초기화</p>
                </div>
              </div>
            </div>
            <div className="relative z-10 mx-auto mt-2 h-1.5 w-24 rounded-full bg-[#78a798]/60" />
          </aside>
        </div>

      </div>
    </main>
  );
}

function RecipeResult({
  data,
  onSave,
  canSave,
  saving,
}: {
  data: ExtractRecipeResponse;
  onSave: () => void;
  canSave: boolean;
  saving: boolean;
}) {
  const recipe = data.recipe;

  return (
    <section className="mt-8 border-t border-[#edf1eb] pt-7">
      {data.source.isDemo ? (
        <div className="mb-6 rounded-2xl border border-[#cfe0d7] bg-[#eef7f2] px-4 py-3 text-sm leading-6 text-[#45685d]">
          <p className="font-extrabold">체험용 레시피 미리보기</p>
          <p>실제 영상 분석 결과가 어떤 모습으로 정리되는지 보여주는 예시이며, 사용 횟수는 차감되지 않아요.</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 inline-flex rounded-full bg-[#e5f0e9] px-3 py-1 text-xs font-bold text-[#487064]">
            {data.source.isDemo
              ? "비로그인 미리보기"
              : `이번 달 ${data.usage.remaining}회 남음 / ${data.usage.limit}회`}
            {data.source.isMock && !data.source.isDemo
              ? " · MOCK 데이터"
              : data.source.fromCache
                ? " · 캐시 사용"
                : ""}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#203f36]">{recipe.title}</h2>
          <p className="mt-2 text-sm text-[#788a83]">
            신뢰도 {Math.round(recipe.confidence_score * 100)}% · 난이도{" "}
            {recipe.difficulty}
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving}
          className="min-h-11 rounded-xl bg-[#397565] px-5 font-bold text-white shadow-sm transition hover:bg-[#2f6557] disabled:cursor-not-allowed disabled:bg-[#a7b7b0]"
        >
          {saving
            ? "담는 중..."
            : canSave
              ? "냉장고에 저장"
              : data.source.isDemo
                ? "예시 데이터입니다"
                : "로그인 후 저장"}
        </button>
      </div>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl bg-[#f4f8f2] p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-[#34584d]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#df6b4f] shadow-sm">
              <LeafIcon className="h-4 w-4" />
            </span>
            준비할 재료
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            {recipe.ingredients.map((ingredient) => (
              <li
                key={`${ingredient.name}-${ingredient.amount}`}
                className="rounded-xl border border-[#e3ebe1] bg-white px-3 py-2.5 text-[#52675f]"
              >
                <span className="font-bold text-[#294a40]">{ingredient.name}</span>
                {ingredient.amount ? ` · ${ingredient.amount}` : ""}
                {ingredient.note ? ` · ${ingredient.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-[#fff7f1] p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-[#6f493e]">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#df6b4f] shadow-sm">
              <SpoonIcon className="h-4 w-4" />
            </span>
            맛있게 만드는 순서
          </h3>
          <ol className="mt-3 space-y-3 text-sm">
            {recipe.steps.map((step) => (
              <li key={step.order} className="flex gap-3 rounded-xl border border-[#f1e4da] bg-white px-3 py-3 leading-6 text-[#5e5851]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ed795b] text-xs font-extrabold text-white">{step.order}</span>
                <span>
                  {step.text}
                  {step.estimated_time ? <span className="font-medium text-[#b26b57]"> · {step.estimated_time}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {recipe.assumptions.length || recipe.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-[#f0d5b7] bg-[#fff8ec] px-4 py-3 text-sm leading-6 text-[#805526]">
          {[...recipe.assumptions, ...recipe.warnings].map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function formatLoginError(message: string) {
  if (/email rate limit|over_email_send_rate_limit/i.test(message)) {
    return "로그인 메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.";
  }

  if (/rate limit|too many requests/i.test(message)) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }

  return message;
}

function UsageMeter({ usage, loading }: { usage: ExtractRecipeResponse["usage"] | null; loading: boolean }) {
  const usedRate = usage
    ? Math.min((usage.used / Math.max(usage.limit, 1)) * 100, 100)
    : 0;

  return (
    <div className="rounded-2xl border border-[#ccddd4] bg-white/75 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#71857d]">이번 달 무료 추출</p>
          <p className="mt-1 text-xl font-black tracking-[-0.03em] text-[#315b50]">
            {loading || !usage ? "확인 중" : `${usage.remaining}회 남음`}
          </p>
        </div>
        <span className="text-xs font-extrabold text-[#d96b50]">
          {usage ? `${usage.used} / ${usage.limit}` : "- / 10"}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dce9e2]">
        <div className="h-full rounded-full bg-[#e4785a] transition-[width]" style={{ width: `${usedRate}%` }} />
      </div>
      <p className="mt-2 text-[11px] font-medium text-[#82938b]">매월 1일에 10회로 자동 초기화돼요.</p>
    </div>
  );
}

function FeatureStep({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#f8faf6] p-3.5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#4a7c6e] shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black tracking-[0.15em] text-[#e17255]">STEP {number}</p>
        <p className="mt-0.5 text-sm font-extrabold text-[#355248]">{title}</p>
        <p className="truncate text-xs text-[#89978f]">{description}</p>
      </div>
    </div>
  );
}

type IconProps = { className?: string };

function FridgeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M5 10h14M8 6.5v1.5M8 13.5v2.5M8 21.5v1M16 21.5v1" />
    </svg>
  );
}

function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="4" />
      <path d="m10 9 5 3-5 3V9Z" />
    </svg>
  );
}

function LinkIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9.5 14.5 5-5" />
      <path d="M7.2 16.8 5.7 18.3a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0" transform="translate(3 0)" />
      <path d="m13.8 7.2 1.5-1.5a3.5 3.5 0 1 1 5 5l-3 3a3.5 3.5 0 0 1-5 0" transform="translate(-3 0)" />
    </svg>
  );
}

function InfoIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

function SpoonIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="8" cy="6.5" rx="3" ry="4.5" />
      <path d="M9.5 10.4 17 21M16.5 3v6.5c0 1.7 1.1 3.1 2.5 3.5M21.5 3v18M19 3v10" />
    </svg>
  );
}

function LeafIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 3.5C12 3.5 5 7 5 14c0 3.5 2.7 6 6 6 7 0 9.5-7.5 9.5-16.5Z" />
      <path d="M4 21c2.5-6 7-9.5 13-13" />
    </svg>
  );
}
