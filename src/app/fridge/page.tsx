"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  EMAIL_OTP_LENGTH,
  formatEmailOtpError,
  normalizeEmailOtp,
} from "@/lib/email-otp";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Recipe } from "@/types/recipe";

type SavedRecipe = {
  id: string;
  youtube_video_id: string;
  source_url: string;
  title: string;
  recipe_json: Recipe;
  created_at: string;
};

type RecipeEditorState =
  | { mode: "new" }
  | { mode: "edit"; recipe: SavedRecipe };

export default function FridgePage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<RecipeEditorState | null>(null);
  const [savingEditor, setSavingEditor] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setAuthReady(true);
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
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

    async function loadRecipes() {
      setLoading(true);
      setMessage(null);

      try {
        const response = await fetch("/api/recipes", {
          headers: { authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error ?? "저장된 레시피를 불러오지 못했습니다.");
        }

        setRecipes(data.recipes as SavedRecipe[]);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadRecipes();
    return () => controller.abort();
  }, [authReady, session?.access_token]);

  function changeEmail(value: string) {
    setEmail(value);
    setOtp("");
    setOtpSent(false);
    setMessage(null);
  }

  async function sendEmailOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("Supabase 공개 환경변수가 설정되지 않았습니다.");
      return;
    }

    setAuthLoading(true);
    const normalizedEmail = email.trim();
    const { error } = await supabase.auth.signInWithOtp({ email: normalizedEmail });
    setAuthLoading(false);

    if (!error) {
      setEmail(normalizedEmail);
      setOtp("");
      setOtpSent(true);
    }

    setMessage(
      error
        ? formatEmailOtpError(error.message)
        : `이메일로 인증번호를 보냈습니다. 메일에서 숫자 ${EMAIL_OTP_LENGTH}자리를 확인하세요.`,
    );
  }

  async function verifyEmailOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!supabase) {
      setMessage("Supabase 공개 환경변수가 설정되지 않았습니다.");
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setAuthLoading(false);

    if (error) {
      setMessage(formatEmailOtpError(error.message));
      return;
    }

    setSession(data.session);
    setOtp("");
    setOtpSent(false);
    setMessage("로그인되었습니다.");
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setSession(null);
    setRecipes([]);
    setOtp("");
    setOtpSent(false);
  }

  async function deleteRecipe(recipe: SavedRecipe) {
    if (!session?.access_token || !window.confirm(`‘${recipe.title}’ 레시피를 냉장고에서 삭제할까요?`)) {
      return;
    }

    setDeletingId(recipe.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/recipes/${recipe.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "레시피를 삭제하지 못했습니다.");
      }

      setRecipes((current) => current.filter((item) => item.id !== recipe.id));
      setExpandedId((current) => (current === recipe.id ? null : current));
      setMessage("레시피를 냉장고에서 꺼냈습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  function openEditor(nextEditor: RecipeEditorState) {
    setEditor(nextEditor);
    setExpandedId(null);
    setMessage(null);
    window.requestAnimationFrame(() => {
      document.getElementById("recipe-editor")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function saveRecipeFromEditor(recipe: Recipe) {
    if (!session?.access_token || !editor) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    const editingRecipe = editor.mode === "edit" ? editor.recipe : null;
    setSavingEditor(true);
    setMessage(null);

    try {
      const response = await fetch(
        editingRecipe ? `/api/recipes/${editingRecipe.id}` : "/api/recipes",
        {
          method: editingRecipe ? "PATCH" : "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ title: recipe.title, recipe }),
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            (editingRecipe
              ? "레시피를 수정하지 못했습니다."
              : "레시피를 저장하지 못했습니다."),
        );
      }

      const savedRecipe = data.recipe as SavedRecipe;
      setRecipes((current) =>
        editingRecipe
          ? current.map((item) =>
              item.id === savedRecipe.id ? savedRecipe : item,
            )
          : [savedRecipe, ...current],
      );
      setEditor(null);
      setMessage(
        editingRecipe
          ? "레시피를 수정했습니다."
          : "직접 작성한 레시피를 냉장고에 담았습니다.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "오류가 발생했습니다.");
    } finally {
      setSavingEditor(false);
    }
  }

  return (
    <main className="kitchen-grid flex-1 bg-[#f5f7ef] text-[#20352f]">
      <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e4efe1] px-3 py-1.5 text-sm font-bold text-[#3b6659]">
              <span className="h-2 w-2 rounded-full bg-[#79ad78]" />
              나의 냉장고
            </div>
            <h1 className="text-4xl font-black tracking-[-0.05em] text-[#193c33] sm:text-5xl">담아둔 레시피를 꺼내보세요.</h1>
            <p className="mt-4 text-base leading-7 text-[#687b74]">좋아하는 레시피를 원하는 만큼 소중하게 보관할 수 있어요.</p>
          </div>
        </section>

        {message ? (
          <div aria-live="polite" className="mt-6 rounded-2xl border border-[#efd6b9] bg-[#fff8ec] px-4 py-3 text-sm font-medium text-[#805526]">{message}</div>
        ) : null}

        {!authReady ? (
          <LoadingFridge />
        ) : session ? (
          loading ? (
            <LoadingFridge />
          ) : (
            <section className="mt-9" aria-label="저장된 레시피 목록">
              <div className="fridge-shine rounded-[34px] bg-[#c9e1d9] p-2 shadow-[0_24px_65px_rgba(44,80,68,0.18)] sm:p-3">
                <div className="relative z-10 overflow-hidden rounded-[27px] border border-white/80 bg-[#e9f4ef]">
                  <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#397565] text-white shadow-[0_7px_18px_rgba(47,101,87,0.2)]">
                        <FridgeIcon className="h-7 w-7" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black tracking-[0.16em] text-[#7a9087]">MY RECIPE FRIDGE</p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <h2 className="text-xl font-black tracking-[-0.04em] text-[#315b50]">나의 냉장고</h2>
                          <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-extrabold text-[#df684b]">{recipes.length}개 보관 중</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={signOut} className="min-h-11 rounded-xl border border-[#bfd0c6] bg-white/65 px-4 text-sm font-bold text-[#627a72] transition hover:bg-white">로그아웃</button>
                      <button type="button" onClick={() => openEditor({ mode: "new" })} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#8eb5a7] bg-white/70 px-4 text-sm font-extrabold text-[#397565] transition hover:bg-white sm:flex-none">
                        <span className="text-lg leading-none">+</span> 직접 추가
                      </button>
                      <Link href="/extract" className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#e36f50] px-4 text-sm font-extrabold text-white shadow-[0_7px_16px_rgba(211,96,68,0.18)] transition hover:bg-[#cf5e42] sm:flex-none">
                        <span className="text-lg leading-none">▶</span> 영상에서 담기
                      </Link>
                    </div>
                  </div>

                  <div className="mx-5 flex items-center gap-3 sm:mx-7">
                    <div className="h-px flex-1 bg-[#c9d9d0]" />
                    <div className="h-2 w-24 rounded-full bg-[#8eb2a6]/65 shadow-inner" />
                    <div className="h-px flex-1 bg-[#c9d9d0]" />
                  </div>

                  {editor ? (
                    <RecipeEditor
                      key={editor.mode === "edit" ? editor.recipe.id : "new"}
                      mode={editor.mode}
                      initialRecipe={
                        editor.mode === "edit" ? editor.recipe.recipe_json : null
                      }
                      saving={savingEditor}
                      onCancel={() => setEditor(null)}
                      onSave={saveRecipeFromEditor}
                    />
                  ) : null}

                  <div className="fridge-interior m-3 mt-5 rounded-[22px] border border-white/90 p-4 sm:m-4 sm:mt-6 sm:p-6">
                    {recipes.length ? (
                      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {recipes.map((recipe, index) => (
                          <SavedRecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            index={index}
                            expanded={expandedId === recipe.id}
                            deleting={deletingId === recipe.id}
                            onToggle={() => setExpandedId((current) => (current === recipe.id ? null : recipe.id))}
                            onEdit={() => openEditor({ mode: "edit", recipe })}
                            onDelete={() => deleteRecipe(recipe)}
                          />
                        ))}
                        <AddRecipeMagnet onClick={() => openEditor({ mode: "new" })} />
                      </div>
                    ) : (
                      <EmptyFridge onManualAdd={() => openEditor({ mode: "new" })} />
                    )}
                  </div>
                </div>
                <div className="relative z-10 mx-auto mt-2 h-2 w-28 rounded-full bg-[#719e90]/65" />
              </div>
            </section>
          )
        ) : (
          <LoginPanel
            email={email}
            otp={otp}
            otpSent={otpSent}
            loading={authLoading}
            setEmail={changeEmail}
            setOtp={setOtp}
            onSend={sendEmailOtp}
            onVerify={verifyEmailOtp}
            configured={Boolean(supabase)}
          />
        )}
      </div>
    </main>
  );
}

function RecipeEditor({ mode, initialRecipe, saving, onCancel, onSave }: { mode: "new" | "edit"; initialRecipe: Recipe | null; saving: boolean; onCancel: () => void; onSave: (recipe: Recipe) => Promise<void> }) {
  const [draft, setDraft] = useState<Recipe>(() =>
    createRecipeDraft(initialRecipe),
  );
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const fieldClass =
    "mt-2 min-h-11 w-full rounded-xl border border-[#cbd9d1] bg-white px-3.5 text-sm text-[#294a40] outline-none transition placeholder:text-[#a4b0aa] focus:border-[#4d8878] focus:ring-4 focus:ring-[#dcece7]";

  function updateIngredient(
    index: number,
    field: "name" | "amount",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index
          ? { ...ingredient, [field]: value || null }
          : ingredient,
      ),
    }));
  }

  function updateStep(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index
          ? {
              ...step,
              text: value,
              source_text: step.source_time === null ? value : step.source_text,
            }
          : step,
      ),
    }));
  }

  function submitEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.title.trim();
    const ingredients = draft.ingredients
      .map((ingredient) => ({
        ...ingredient,
        name: ingredient.name.trim(),
        amount: ingredient.amount?.trim() || null,
        note: ingredient.note?.trim() || null,
      }))
      .filter((ingredient) => ingredient.name);
    const steps = draft.steps
      .map((step) => ({
        ...step,
        text: step.text.trim(),
      }))
      .filter((step) => step.text)
      .map((step, index) => ({ ...step, order: index + 1 }));

    if (!title || ingredients.length === 0 || steps.length === 0) {
      setFormMessage("레시피 이름, 재료, 조리 순서를 한 개 이상 입력해 주세요.");
      return;
    }

    setFormMessage(null);
    void onSave({
      ...draft,
      title,
      servings: draft.servings?.trim() || null,
      cook_time: draft.cook_time?.trim() || null,
      ingredients,
      steps,
    });
  }

  return (
    <section id="recipe-editor" className="mx-3 mt-5 scroll-mt-24 rounded-[24px] border border-[#d6e2da] bg-[#fffdf8] p-5 shadow-[0_14px_34px_rgba(56,82,70,0.10)] sm:mx-4 sm:mt-6 sm:p-7">
      <div className="flex flex-col gap-3 border-b border-[#e7ece6] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black tracking-[0.16em] text-[#d66c50]">WRITE YOUR RECIPE</p>
          <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[#294d42]">
            {mode === "edit" ? "레시피 수정하기" : "직접 레시피 담기"}
          </h3>
          <p className="mt-1 text-sm text-[#788981]">내가 아는 레시피를 재료와 순서로 차곡차곡 적어보세요.</p>
        </div>
        <button type="button" onClick={onCancel} className="self-start rounded-xl border border-[#d7dfd9] bg-white px-3.5 py-2 text-sm font-bold text-[#71817a] transition hover:bg-[#f7f9f6]">닫기</button>
      </div>

      <form onSubmit={submitEditor} className="mt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-bold text-[#38544b] md:col-span-2">
            레시피 이름 <span className="text-[#d76549]">*</span>
            <input autoFocus required maxLength={120} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="예: 우리 집 김치찌개" className={fieldClass} />
          </label>
          <label className="text-sm font-bold text-[#38544b]">
            인분
            <input maxLength={120} value={draft.servings ?? ""} onChange={(event) => setDraft((current) => ({ ...current, servings: event.target.value || null }))} placeholder="예: 2인분" className={fieldClass} />
          </label>
          <label className="text-sm font-bold text-[#38544b]">
            조리 시간
            <input maxLength={120} value={draft.cook_time ?? ""} onChange={(event) => setDraft((current) => ({ ...current, cook_time: event.target.value || null }))} placeholder="예: 약 30분" className={fieldClass} />
          </label>
          <label className="text-sm font-bold text-[#38544b] md:col-span-2 lg:col-span-1">
            난이도
            <select value={draft.difficulty} onChange={(event) => setDraft((current) => ({ ...current, difficulty: event.target.value as Recipe["difficulty"] }))} className={fieldClass}>
              <option value="unknown">미정</option>
              <option value="easy">쉬움</option>
              <option value="medium">보통</option>
              <option value="hard">어려움</option>
            </select>
          </label>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-[#31574c]">준비할 재료</h4>
                <p className="mt-1 text-xs text-[#89978f]">재료명은 필수, 양은 선택이에요.</p>
              </div>
              <button type="button" onClick={() => setDraft((current) => ({ ...current, ingredients: [...current.ingredients, { name: "", amount: null, note: null }] }))} className="rounded-xl bg-[#e4efe9] px-3 py-2 text-xs font-extrabold text-[#397565]">+ 재료 추가</button>
            </div>
            <div className="mt-3 space-y-2.5">
              {draft.ingredients.map((ingredient, index) => (
                <div key={`ingredient-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)_40px] gap-2">
                  <input aria-label={`${index + 1}번째 재료명`} required maxLength={120} value={ingredient.name} onChange={(event) => updateIngredient(index, "name", event.target.value)} placeholder="재료명" className="min-h-11 min-w-0 rounded-xl border border-[#d5dfd8] bg-white px-3 text-sm outline-none focus:border-[#4d8878]" />
                  <input aria-label={`${index + 1}번째 재료 양`} maxLength={120} value={ingredient.amount ?? ""} onChange={(event) => updateIngredient(index, "amount", event.target.value)} placeholder="양" className="min-h-11 min-w-0 rounded-xl border border-[#d5dfd8] bg-white px-3 text-sm outline-none focus:border-[#4d8878]" />
                  <button type="button" aria-label={`${index + 1}번째 재료 삭제`} disabled={draft.ingredients.length === 1} onClick={() => setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index) }))} className="min-h-11 rounded-xl border border-[#eaded9] text-[#b57b6d] disabled:cursor-not-allowed disabled:opacity-30">×</button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-[#31574c]">조리 순서</h4>
                <p className="mt-1 text-xs text-[#89978f]">한 단계씩 짧고 분명하게 적어주세요.</p>
              </div>
              <button type="button" onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, createEmptyStep(current.steps.length + 1)] }))} className="rounded-xl bg-[#fff0e9] px-3 py-2 text-xs font-extrabold text-[#d6674d]">+ 순서 추가</button>
            </div>
            <div className="mt-3 space-y-2.5">
              {draft.steps.map((step, index) => (
                <div key={`step-${index}`} className="grid grid-cols-[32px_minmax(0,1fr)_40px] items-start gap-2">
                  <span className="mt-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#e4785a] text-xs font-black text-white">{index + 1}</span>
                  <textarea aria-label={`${index + 1}번째 조리 순서`} required maxLength={1000} rows={2} value={step.text} onChange={(event) => updateStep(index, event.target.value)} placeholder="조리 방법을 입력하세요" className="min-h-[68px] min-w-0 resize-y rounded-xl border border-[#d5dfd8] bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:border-[#4d8878]" />
                  <button type="button" aria-label={`${index + 1}번째 조리 순서 삭제`} disabled={draft.steps.length === 1} onClick={() => setDraft((current) => ({ ...current, steps: current.steps.filter((_, stepIndex) => stepIndex !== index) }))} className="min-h-11 rounded-xl border border-[#eaded9] text-[#b57b6d] disabled:cursor-not-allowed disabled:opacity-30">×</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {formMessage ? <p className="mt-5 rounded-xl bg-[#fff3eb] px-4 py-3 text-sm font-bold text-[#a65f49]">{formMessage}</p> : null}

        <div className="mt-7 flex flex-col-reverse justify-end gap-2 border-t border-[#e7ece6] pt-5 sm:flex-row">
          <button type="button" onClick={onCancel} className="min-h-12 rounded-xl border border-[#cfdad3] bg-white px-5 font-bold text-[#6e8178]">취소</button>
          <button type="submit" disabled={saving} className="min-h-12 rounded-xl bg-[#e36f50] px-6 font-extrabold text-white shadow-[0_7px_16px_rgba(211,96,68,0.18)] disabled:cursor-not-allowed disabled:bg-[#b7c1bc]">
            {saving ? "저장 중..." : mode === "edit" ? "수정 내용 저장" : "냉장고에 담기"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SavedRecipeCard({ recipe, index, expanded, deleting, onToggle, onEdit, onDelete }: { recipe: SavedRecipe; index: number; expanded: boolean; deleting: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const detail = recipe.recipe_json;
  const colors = ["bg-[#fff1e8]", "bg-[#eef5e9]", "bg-[#fff7d9]", "bg-[#eaf3f2]", "bg-[#f4edfa]"];
  const emojis = ["🍲", "🥗", "🍝", "🥘", "🍳"];
  const rotations = ["md:-rotate-[0.35deg]", "md:rotate-[0.3deg]", "md:-rotate-[0.2deg]"];

  return (
    <article className={`relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white bg-white/95 shadow-[0_12px_28px_rgba(48,73,62,0.11)] transition duration-200 hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[0_16px_34px_rgba(48,73,62,0.15)] ${expanded ? "md:col-span-2 md:rotate-0 xl:col-span-3" : rotations[index % rotations.length]}`}>
      <span className="absolute left-1/2 top-0 h-3 w-14 -translate-x-1/2 rounded-b-md bg-[#f4d694]/80 shadow-sm" aria-hidden="true" />
      <div className="flex flex-1 gap-4 p-4 pt-6 sm:p-5 sm:pt-7">
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-inner ${colors[index % colors.length]}`}>{emojis[index % emojis.length]}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-[#8a9992]">{formatDate(recipe.created_at)}에 담음</p>
          <h2 className="mt-1 truncate text-lg font-black tracking-[-0.03em] text-[#294a40]">{recipe.title}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#6f827a]">
            {detail.servings ? <span className="rounded-full bg-[#f2f6f0] px-2.5 py-1">{detail.servings}</span> : null}
            {detail.cook_time ? <span className="rounded-full bg-[#f2f6f0] px-2.5 py-1">{detail.cook_time}</span> : null}
            <span className="rounded-full bg-[#f2f6f0] px-2.5 py-1">{difficultyLabel(detail.difficulty)}</span>
          </div>
        </div>
      </div>

      <div className="flex border-t border-[#edf1eb]">
        <button type="button" aria-expanded={expanded} onClick={onToggle} className="min-h-11 flex-1 text-sm font-extrabold text-[#397565] transition hover:bg-[#f3f8f4]">
          {expanded ? "레시피 접기" : "레시피 꺼내보기"}
        </button>
        <button type="button" onClick={onEdit} className="min-h-11 border-l border-[#edf1eb] px-4 text-sm font-bold text-[#657d73] transition hover:bg-[#f7faf7]">
          수정
        </button>
        <button type="button" disabled={deleting} onClick={onDelete} className="min-h-11 border-l border-[#edf1eb] px-4 text-sm font-bold text-[#b47766] transition hover:bg-[#fff6f2] disabled:cursor-not-allowed disabled:opacity-50">
          {deleting ? "삭제 중" : "삭제"}
        </button>
      </div>

      {expanded ? (
        <div className="grid gap-6 border-t border-[#e4ebe2] bg-[#f8fbf7] p-5 sm:p-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-extrabold text-[#3c5c52]">준비할 재료</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#62746d]">
              {detail.ingredients.map((ingredient) => (
                <li key={`${ingredient.name}-${ingredient.amount}`} className="flex justify-between gap-3 border-b border-[#e7ece5] pb-2">
                  <span className="font-bold text-[#3f5d54]">{ingredient.name}</span>
                  <span className="text-right">{ingredient.amount ?? ingredient.note ?? "적당량"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#3c5c52]">조리 순서</h3>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-[#62746d]">
              {detail.steps.map((step) => (
                <li key={step.order} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e4785a] text-xs font-black text-white">{step.order}</span>
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>
          </div>
          {isExternalSource(recipe.source_url) ? (
            <a href={recipe.source_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#4e766a] underline decoration-[#a8bdb4] underline-offset-4 md:col-span-2">원본 Shorts 영상 보기 ↗</a>
          ) : (
            <p className="text-sm font-bold text-[#80928a] md:col-span-2">직접 작성한 레시피</p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function EmptyFridge({ onManualAdd }: { onManualAdd: () => void }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[#afc7bc] bg-white/60 px-6 py-14 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#e1eee8] text-4xl">🧊</div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#31574c]">냉장고가 아직 비어 있어요</h2>
      <p className="mt-2 text-sm leading-6 text-[#74867f]">직접 작성하거나 요리 영상에서 첫 번째 레시피를 담아보세요.</p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <button type="button" onClick={onManualAdd} className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#9fbcb1] bg-white px-5 font-extrabold text-[#397565]">직접 작성하기</button>
        <Link href="/extract" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#397565] px-5 font-extrabold text-white">영상에서 담기</Link>
      </div>
    </div>
  );
}

function AddRecipeMagnet({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-40 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-[#b8cec4] bg-white/45 p-5 text-center transition hover:-translate-y-0.5 hover:border-[#85aa9d] hover:bg-white/70">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dcebe4] text-2xl font-light text-[#4b786b] transition group-hover:bg-[#cfe4da]">+</span>
      <span className="mt-3 text-sm font-extrabold text-[#52766b]">직접 레시피 추가</span>
      <span className="mt-1 text-xs font-medium text-[#8a9a93]">내 레시피를 바로 적어보세요</span>
    </button>
  );
}

function LoginPanel({ email, otp, otpSent, loading, setEmail, setOtp, onSend, onVerify, configured }: { email: string; otp: string; otpSent: boolean; loading: boolean; setEmail: (value: string) => void; setOtp: (value: string) => void; onSend: (event: React.FormEvent<HTMLFormElement>) => void; onVerify: (event: React.FormEvent<HTMLFormElement>) => void; configured: boolean }) {
  return (
    <section className="fridge-shine mx-auto mt-10 max-w-xl rounded-[32px] bg-[#cce3db] p-2 shadow-[0_24px_60px_rgba(48,73,62,0.16)]">
      <div className="relative z-10 rounded-[25px] border border-white/80 bg-[#edf6f1] p-6 text-center sm:p-9">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#397565] text-3xl shadow-lg">🔐</div>
        <p className="mt-5 text-[10px] font-black tracking-[0.16em] text-[#82968e]">PRIVATE RECIPE FRIDGE</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#294d42]">내 냉장고를 열어볼까요?</h2>
        <p className="mt-2 text-sm leading-6 text-[#74867f]">저장된 레시피는 로그인한 계정에서만 안전하게 확인할 수 있어요.</p>
        <div className="mx-auto my-6 h-2 w-24 rounded-full bg-[#92b4a8]/60" />
        <form onSubmit={onSend} className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="fridge-email" className="sr-only">이메일</label>
          <input id="fridge-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@example.com" className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#c7d6cc] bg-white/85 px-4 outline-none focus:border-[#4d8878] focus:ring-4 focus:ring-white/70" />
          <button type="submit" disabled={!configured || loading} className="min-h-12 rounded-xl bg-[#e36f50] px-5 font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#b9c3be]">{loading ? "전송 중" : otpSent ? "인증번호 다시 받기" : "인증번호 받기"}</button>
        </form>
        {otpSent ? (
          <form onSubmit={onVerify} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="fridge-email-otp" className="sr-only">이메일 인증번호</label>
            <input id="fridge-email-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern={`[0-9]{${EMAIL_OTP_LENGTH}}`} maxLength={EMAIL_OTP_LENGTH} required value={otp} onChange={(event) => setOtp(normalizeEmailOtp(event.target.value))} placeholder={`인증번호 숫자 ${EMAIL_OTP_LENGTH}자리`} className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#c7d6cc] bg-white/85 px-4 text-center text-lg font-extrabold tracking-[0.3em] outline-none placeholder:text-sm placeholder:font-medium placeholder:tracking-normal focus:border-[#4d8878] focus:ring-4 focus:ring-white/70" />
            <button type="submit" disabled={loading || otp.length !== EMAIL_OTP_LENGTH} className="min-h-12 rounded-xl bg-[#397565] px-5 font-extrabold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-[#b9c3be]">{loading ? "확인 중" : "인증하고 로그인"}</button>
          </form>
        ) : null}
        {!configured ? <p className="mt-3 text-xs font-medium text-[#a26c5b]">Supabase 환경변수 설정이 필요합니다.</p> : null}
      </div>
      <div className="relative z-10 mx-auto mt-2 h-2 w-24 rounded-full bg-[#719e90]/65" />
    </section>
  );
}

function LoadingFridge() {
  return (
    <div className="mt-10 rounded-[32px] bg-[#cfe4dd] p-3 shadow-[0_20px_50px_rgba(48,73,62,0.1)]" aria-label="저장된 레시피를 불러오는 중">
      <div className="rounded-[24px] border border-white/80 bg-[#edf6f1] p-5 sm:p-7">
        <div className="h-14 animate-pulse rounded-2xl bg-white/65" />
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-[22px] border border-white bg-white/70" />
          ))}
        </div>
      </div>
    </div>
  );
}

function FridgeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M5 10h14M8 6.5v1.5M8 13.5v2.5M8 21.5v1M16 21.5v1" />
    </svg>
  );
}

function difficultyLabel(difficulty: Recipe["difficulty"]) {
  return { easy: "쉬움", medium: "보통", hard: "어려움", unknown: "난이도 미정" }[difficulty];
}

function createEmptyStep(order: number): Recipe["steps"][number] {
  return {
    order,
    text: "",
    estimated_time: null,
    source_text: "",
    source_time: null,
    confidence: 1,
  };
}

function createRecipeDraft(recipe: Recipe | null): Recipe {
  if (recipe) {
    return {
      ...recipe,
      ingredients: recipe.ingredients.length
        ? recipe.ingredients.map((ingredient) => ({ ...ingredient }))
        : [{ name: "", amount: null, note: null }],
      steps: recipe.steps.length
        ? recipe.steps.map((step) => ({ ...step }))
        : [createEmptyStep(1)],
      assumptions: [...recipe.assumptions],
      warnings: [...recipe.warnings],
    };
  }

  return {
    title: "",
    servings: null,
    ingredients: [{ name: "", amount: null, note: null }],
    steps: [createEmptyStep(1)],
    cook_time: null,
    difficulty: "unknown",
    confidence_score: 1,
    assumptions: [],
    warnings: [],
  };
}

function isExternalSource(value: string) {
  return value.startsWith("https://") || value.startsWith("http://");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(new Date(value));
}
