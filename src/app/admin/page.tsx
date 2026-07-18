"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type AdminCostData = {
  credit: {
    total: number;
    spent: number;
    estimatedRemaining: number;
    grantedAt: string;
    expiresAt: string;
    currency: "usd";
  };
  currentMonth: {
    spent: number;
    monthKey: string;
  };
  dailyCosts: Array<{ date: string; amount: number }>;
  asOf: string;
  billingUrl: string;
};

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [data, setData] = useState<AdminCostData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (!nextSession) {
        setData(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const accessToken = session?.access_token;

    if (!accessToken) {
      return;
    }

    const verifiedAccessToken = accessToken;
    const controller = new AbortController();

    async function loadInitialCosts() {
      setLoading(true);
      setNotice(null);

      try {
        setData(await requestCosts(verifiedAccessToken, controller.signal));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setData(null);
        setNotice(
          error instanceof Error ? error.message : "관리자 비용 정보를 불러오지 못했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadInitialCosts();
    return () => controller.abort();
  }, [session?.access_token]);

  async function refreshCosts() {
    const accessToken = session?.access_token;

    if (!accessToken) {
      return;
    }

    setLoading(true);
    setNotice(null);

    try {
      setData(await requestCosts(accessToken));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "관리자 비용 정보를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!supabase) {
      setNotice("로그인 이메일 서비스를 사용할 수 없습니다.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/admin" },
    });

    setNotice(
      error
        ? error.message
        : "관리자 로그인 링크를 이메일로 보냈습니다. 메일함을 확인해 주세요.",
    );
  }

  const usedPercent = data
    ? Math.min((data.credit.spent / data.credit.total) * 100, 100)
    : 0;
  const maxDailyCost = Math.max(
    0.01,
    ...(data?.dailyCosts.map((item) => item.amount) ?? []),
  );

  return (
    <main className="kitchen-grid flex-1 bg-[#f5f7ef] text-[#20352f]">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        <section className="mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e4efe1] px-3 py-1.5 text-sm font-bold text-[#3b6659]">
              <span className="h-2 w-2 rounded-full bg-[#ef7d5e]" />
              ADMIN ONLY
            </div>
            <h1 className="text-4xl font-black tracking-[-0.05em] text-[#193c33] sm:text-5xl">
              레시담 운영 현황
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#687b73] sm:text-base">
              OpenAI 크레딧과 비용을 안전하게 확인하는 관리자 전용 화면입니다.
            </p>
          </div>

          {session ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-[#d5e0d7] bg-white/80 px-3 py-2 text-sm font-bold text-[#506a61]">
                {session.user.email}
              </span>
              <button
                type="button"
                onClick={() => void refreshCosts()}
                disabled={loading}
                className="min-h-10 rounded-xl bg-[#397565] px-4 text-sm font-extrabold text-white disabled:bg-[#9db3ab]"
              >
                {loading ? "새로고침 중" : "새로고침"}
              </button>
            </div>
          ) : null}
        </section>

        {!authReady ? (
          <AdminMessage>로그인 상태를 확인하고 있습니다.</AdminMessage>
        ) : !session ? (
          <section className="mx-auto max-w-lg rounded-[28px] border border-[#d9e3da] bg-white p-6 shadow-[0_20px_60px_rgba(48,73,62,0.10)] sm:p-8">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#397565] text-xl text-white">
              🔐
            </div>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#24493f]">관리자 로그인</h2>
            <p className="mt-2 text-sm leading-6 text-[#74867f]">허용된 관리자 이메일로만 접근할 수 있습니다.</p>
            <form className="mt-6 flex flex-col gap-3" onSubmit={sendMagicLink}>
              <label htmlFor="admin-email" className="text-sm font-extrabold text-[#405e54]">관리자 이메일</label>
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@example.com"
                className="min-h-12 rounded-xl border border-[#cbd9cf] bg-[#fbfcf8] px-4 outline-none focus:border-[#4d8878] focus:ring-4 focus:ring-[#dcece7]"
              />
              <button type="submit" className="min-h-12 rounded-xl bg-[#e36f50] px-4 font-extrabold text-white">
                이메일로 관리자 로그인
              </button>
            </form>
            {notice ? <p className="mt-4 rounded-xl bg-[#fff7e8] px-4 py-3 text-sm font-bold text-[#805526]">{notice}</p> : null}
          </section>
        ) : loading && !data ? (
          <AdminMessage>OpenAI 비용 정보를 불러오고 있습니다.</AdminMessage>
        ) : notice ? (
          <AdminMessage tone="error">{notice}</AdminMessage>
        ) : data ? (
          <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="추정 잔액" value={formatUsd(data.credit.estimatedRemaining)} accent="green" />
              <MetricCard label="총 사용액" value={formatUsd(data.credit.spent)} accent="orange" />
              <MetricCard label="이번 달 사용액" value={formatUsd(data.currentMonth.spent)} accent="yellow" />
              <MetricCard label="크레딧 만료일" value={formatKoreanDate(data.credit.expiresAt)} accent="blue" />
            </section>

            <section className="rounded-[28px] border border-[#d9e3da] bg-white p-6 shadow-[0_16px_48px_rgba(48,73,62,0.08)] sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black tracking-[0.14em] text-[#df684b]">OPENAI CREDIT</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#24493f]">
                    {formatUsd(data.credit.total)} 중 {formatUsd(data.credit.spent)} 사용
                  </h2>
                </div>
                <a
                  href={data.billingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#bfd0c5] bg-[#f8fbf7] px-4 text-sm font-extrabold text-[#3e6659]"
                >
                  OpenAI 실제 잔액 확인 ↗
                </a>
              </div>
              <div className="mt-7 h-4 overflow-hidden rounded-full bg-[#edf2eb]">
                <div className="h-full rounded-full bg-[#df684b] transition-all" style={{ width: `${usedPercent}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-xs font-bold text-[#7a8b84]">
                <span>사용 {usedPercent.toFixed(1)}%</span>
                <span>잔여 {(100 - usedPercent).toFixed(1)}%</span>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#d9e3da] bg-white p-6 shadow-[0_16px_48px_rgba(48,73,62,0.08)] sm:p-8">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-black tracking-[0.14em] text-[#397565]">DAILY COST</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#24493f]">최근 비용 발생 내역</h2>
                </div>
                <span className="text-xs font-bold text-[#84938d]">UTC 기준</span>
              </div>
              {data.dailyCosts.length ? (
                <div className="mt-7 space-y-3">
                  {data.dailyCosts.map((item) => (
                    <div key={item.date} className="grid grid-cols-[88px_minmax(0,1fr)_72px] items-center gap-3 text-sm">
                      <span className="font-bold text-[#60736c]">{item.date.slice(5)}</span>
                      <div className="h-3 overflow-hidden rounded-full bg-[#eef2ec]">
                        <div
                          className="h-full min-w-1 rounded-full bg-[#78a99a]"
                          style={{ width: `${Math.max((item.amount / maxDailyCost) * 100, 2)}%` }}
                        />
                      </div>
                      <span className="text-right font-black text-[#34564c]">{formatUsd(item.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-7 rounded-2xl bg-[#f3f7f1] px-4 py-5 text-sm font-bold text-[#708179]">비용이 발생한 날짜가 아직 없습니다.</p>
              )}
            </section>

            <p className="text-center text-xs leading-5 text-[#84938d]">
              비용 데이터는 OpenAI Costs API 기준이며 실제 Billing 반영에는 지연이 있을 수 있습니다. 마지막 확인: {formatKoreanDateTime(data.asOf)}
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent: "green" | "orange" | "yellow" | "blue" }) {
  const colors = {
    green: "bg-[#e4f0e9] text-[#397565]",
    orange: "bg-[#fff0e9] text-[#d86649]",
    yellow: "bg-[#fff7d8] text-[#8a712e]",
    blue: "bg-[#e9f1f3] text-[#4f7378]",
  };

  return (
    <article className="rounded-[24px] border border-[#dce5dc] bg-white p-5 shadow-[0_12px_32px_rgba(48,73,62,0.07)]">
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${colors[accent]}`}>{label}</span>
      <p className="mt-5 text-2xl font-black tracking-[-0.04em] text-[#24493f]">{value}</p>
    </article>
  );
}

function AdminMessage({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "error" }) {
  return (
    <section className={`rounded-[24px] border px-5 py-8 text-center text-sm font-extrabold ${tone === "error" ? "border-[#edcdbd] bg-[#fff5ef] text-[#965b48]" : "border-[#d9e3da] bg-white text-[#60736c]"}`}>
      {children}
    </section>
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(value);
}

function formatKoreanDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(`${value}T00:00:00Z`));
}

function formatKoreanDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

async function requestCosts(accessToken: string, signal?: AbortSignal) {
  const response = await fetch("/api/admin/openai-costs", {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  const result = (await response.json()) as AdminCostData & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "관리자 비용 정보를 불러오지 못했습니다.");
  }

  return result;
}
