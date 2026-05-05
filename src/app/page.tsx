"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { ExtractRecipeResponse, Recipe } from "@/types/recipe";

function createAnonymousId() {
  const existing = window.localStorage.getItem("recipetube_anonymous_id");

  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID().replaceAll("-", "");
  window.localStorage.setItem("recipetube_anonymous_id", id);
  return id;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [anonymousId, setAnonymousId] = useState("");
  const [result, setResult] = useState<ExtractRecipeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  async function extractRecipe(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setResult(null);

    try {
      const nextAnonymousId = anonymousId || createAnonymousId();
      setAnonymousId(nextAnonymousId);

      const response = await fetch("/api/recipes/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-anonymous-id": nextAnonymousId,
          ...(session?.access_token
            ? { authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "레시피를 추출하지 못했습니다.");
      }

      setResult(data as ExtractRecipeResponse);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("Supabase 공개 환경변수가 설정되지 않았습니다.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setMessage(
      error ? error.message : "로그인 링크를 이메일로 보냈습니다. 메일함을 확인하세요.",
    );
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
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

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#25211b]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-5 border-b border-[#ded8cc] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7d4f2a]">
              RecipeTube
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              YouTube Shorts 링크로 레시피를 정리합니다.
            </h1>
          </div>
          <div className="rounded-md border border-[#ded8cc] bg-white px-4 py-3 text-sm text-[#5f574c] shadow-sm">
            <p>비로그인 월 2회</p>
            <p>무료회원 월 5회, 저장 5개</p>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-md border border-[#ded8cc] bg-white p-5 shadow-sm">
            <form className="flex flex-col gap-4" onSubmit={extractRecipe}>
              <label className="text-sm font-medium text-[#4d453a]" htmlFor="url">
                YouTube Shorts URL
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  id="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://youtube.com/shorts/..."
                  className="min-h-12 flex-1 rounded-md border border-[#cfc6b6] bg-[#fffdf9] px-4 text-base outline-none ring-[#8a5a34] focus:ring-2"
                />
                <button
                  disabled={loading || !url}
                  className="min-h-12 rounded-md bg-[#2f5d50] px-5 font-semibold text-white transition hover:bg-[#274d43] disabled:cursor-not-allowed disabled:bg-[#9aa79f]"
                >
                  {loading ? "분석 중" : "레시피 추출"}
                </button>
              </div>
              <p className="text-sm text-[#756c61]">
                `/shorts/영상ID` 형식만 허용합니다. 일반 YouTube 영상 링크는 분석하지 않습니다.
              </p>
            </form>

            {message ? (
              <div className="mt-5 rounded-md border border-[#e4c7a4] bg-[#fff8ed] px-4 py-3 text-sm text-[#6f451c]">
                {message}
              </div>
            ) : null}

            {result ? (
              <RecipeResult
                data={result}
                onSave={() => saveRecipe(result.recipe)}
                canSave={Boolean(session)}
                saving={saving}
              />
            ) : null}
          </section>

          <aside className="rounded-md border border-[#ded8cc] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">계정</h2>
            {session?.user.email ? (
              <div className="mt-4 flex flex-col gap-3 text-sm">
                <p className="text-[#4d453a]">{session.user.email}</p>
                <button
                  onClick={signOut}
                  className="min-h-10 rounded-md border border-[#cfc6b6] px-4 font-medium"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <form className="mt-4 flex flex-col gap-3" onSubmit={sendMagicLink}>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="email@example.com"
                  className="min-h-11 rounded-md border border-[#cfc6b6] bg-[#fffdf9] px-3 outline-none ring-[#8a5a34] focus:ring-2"
                />
                <button className="min-h-10 rounded-md bg-[#7d4f2a] px-4 font-semibold text-white">
                  이메일로 로그인
                </button>
              </form>
            )}
            <div className="mt-6 border-t border-[#ece6dc] pt-5 text-sm text-[#756c61]">
              <p>Supabase Auth 설정 후 이메일 매직링크 로그인이 동작합니다.</p>
            </div>
          </aside>
        </div>
      </section>
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
    <section className="mt-8 border-t border-[#ece6dc] pt-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-[#756c61]">
            남은 횟수 {data.usage.remaining} / {data.usage.limit}
            {data.source.fromCache ? " · 캐시 사용" : ""}
          </p>
          <h2 className="mt-2 text-3xl font-semibold">{recipe.title}</h2>
          <p className="mt-2 text-sm text-[#756c61]">
            신뢰도 {Math.round(recipe.confidence_score * 100)}% · 난이도{" "}
            {recipe.difficulty}
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={!canSave || saving}
          className="min-h-11 rounded-md bg-[#2f5d50] px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#9aa79f]"
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold">재료</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {recipe.ingredients.map((ingredient) => (
              <li
                key={`${ingredient.name}-${ingredient.amount}`}
                className="rounded-md bg-[#f8f3ea] px-3 py-2"
              >
                <span className="font-medium">{ingredient.name}</span>
                {ingredient.amount ? ` · ${ingredient.amount}` : ""}
                {ingredient.note ? ` · ${ingredient.note}` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold">조리 순서</h3>
          <ol className="mt-3 space-y-3 text-sm">
            {recipe.steps.map((step) => (
              <li key={step.order} className="rounded-md bg-[#f8f3ea] px-3 py-2">
                <span className="font-semibold">{step.order}. </span>
                {step.text}
                {step.estimated_time ? (
                  <span className="text-[#756c61]"> · {step.estimated_time}</span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </div>

      {recipe.assumptions.length || recipe.warnings.length ? (
        <div className="mt-6 rounded-md border border-[#e4c7a4] bg-[#fff8ed] px-4 py-3 text-sm text-[#6f451c]">
          {[...recipe.assumptions, ...recipe.warnings].map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
