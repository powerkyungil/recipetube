"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  EMAIL_OTP_LENGTH,
  formatEmailOtpError,
  normalizeEmailOtp,
} from "@/lib/email-otp";
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

type AdminMembersData = {
  summary: {
    members: number;
    savedRecipes: number;
    aiGeneratedRecipes: number;
  };
  members: Array<{
    id: string;
    nickname: string;
    email: string;
    joinedAt: string;
    lastSignInAt: string | null;
    savedRecipeCount: number;
    extractionCount: number;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

export default function AdminPage() {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [data, setData] = useState<AdminCostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [membersData, setMembersData] = useState<AdminMembersData | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersNotice, setMembersNotice] = useState<string | null>(null);
  const [memberPage, setMemberPage] = useState(1);

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
        setMembersData(null);
        setMemberPage(1);
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

  useEffect(() => {
    const accessToken = session?.access_token;

    if (!accessToken) {
      return;
    }

    const verifiedAccessToken = accessToken;
    const controller = new AbortController();

    async function loadMembers() {
      setMembersLoading(true);
      setMembersNotice(null);

      try {
        setMembersData(
          await requestMembers(verifiedAccessToken, memberPage, controller.signal),
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setMembersNotice(
          error instanceof Error ? error.message : "회원 현황을 불러오지 못했습니다.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setMembersLoading(false);
        }
      }
    }

    void loadMembers();
    return () => controller.abort();
  }, [memberPage, session?.access_token]);

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

  async function refreshMembers() {
    const accessToken = session?.access_token;

    if (!accessToken) {
      return;
    }

    setMembersLoading(true);
    setMembersNotice(null);

    try {
      setMembersData(await requestMembers(accessToken, memberPage));
    } catch (error) {
      setMembersNotice(
        error instanceof Error ? error.message : "회원 현황을 불러오지 못했습니다.",
      );
    } finally {
      setMembersLoading(false);
    }
  }

  function refreshDashboard() {
    void refreshCosts();
    void refreshMembers();
  }

  function changeEmail(value: string) {
    setEmail(value);
    setOtp("");
    setOtpSent(false);
    setNotice(null);
  }

  async function sendEmailOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!supabase) {
      setNotice("로그인 이메일 서비스를 사용할 수 없습니다.");
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

    setNotice(
      error
        ? formatEmailOtpError(error.message)
        : `관리자 이메일로 인증번호를 보냈습니다. 숫자 ${EMAIL_OTP_LENGTH}자리를 확인해 주세요.`,
    );
  }

  async function verifyEmailOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    if (!supabase) {
      setNotice("로그인 이메일 서비스를 사용할 수 없습니다.");
      return;
    }

    setAuthLoading(true);
    const { data: authData, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setAuthLoading(false);

    if (error) {
      setNotice(formatEmailOtpError(error.message));
      return;
    }

    setSession(authData.session);
    setOtp("");
    setOtpSent(false);
    setNotice("로그인되었습니다.");
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
              회원과 레시피 이용 현황, OpenAI 비용을 안전하게 확인하는 관리자 전용 화면입니다.
            </p>
          </div>

          {session ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-[#d5e0d7] bg-white/80 px-3 py-2 text-sm font-bold text-[#506a61]">
                {session.user.email}
              </span>
              <button
                type="button"
                onClick={refreshDashboard}
                disabled={loading || membersLoading}
                className="min-h-10 rounded-xl bg-[#397565] px-4 text-sm font-extrabold text-white disabled:bg-[#9db3ab]"
              >
                {loading || membersLoading ? "새로고침 중" : "새로고침"}
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
            <form className="mt-6 flex flex-col gap-3" onSubmit={sendEmailOtp}>
              <label htmlFor="admin-email" className="text-sm font-extrabold text-[#405e54]">관리자 이메일</label>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => changeEmail(event.target.value)}
                placeholder="admin@example.com"
                className="min-h-12 rounded-xl border border-[#cbd9cf] bg-[#fbfcf8] px-4 outline-none focus:border-[#4d8878] focus:ring-4 focus:ring-[#dcece7]"
              />
              <button type="submit" disabled={authLoading} className="min-h-12 rounded-xl bg-[#e36f50] px-4 font-extrabold text-white disabled:cursor-wait disabled:bg-[#b9c3be]">
                {authLoading ? "전송 중" : otpSent ? "인증번호 다시 받기" : "인증번호 받기"}
              </button>
            </form>
            {otpSent ? (
              <form className="mt-3 flex flex-col gap-3" onSubmit={verifyEmailOtp}>
                <label htmlFor="admin-email-otp" className="text-sm font-extrabold text-[#405e54]">이메일 인증번호</label>
                <input
                  id="admin-email-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern={`[0-9]{${EMAIL_OTP_LENGTH}}`}
                  maxLength={EMAIL_OTP_LENGTH}
                  required
                  value={otp}
                  onChange={(event) => setOtp(normalizeEmailOtp(event.target.value))}
                  placeholder={`숫자 ${EMAIL_OTP_LENGTH}자리`}
                  className="min-h-12 rounded-xl border border-[#cbd9cf] bg-[#fbfcf8] px-4 text-center text-lg font-extrabold tracking-[0.3em] outline-none placeholder:text-sm placeholder:font-medium placeholder:tracking-normal focus:border-[#4d8878] focus:ring-4 focus:ring-[#dcece7]"
                />
                <button type="submit" disabled={authLoading || otp.length !== EMAIL_OTP_LENGTH} className="min-h-12 rounded-xl bg-[#397565] px-4 font-extrabold text-white disabled:cursor-not-allowed disabled:bg-[#b9c3be]">
                  {authLoading ? "확인 중" : "인증하고 관리자 로그인"}
                </button>
              </form>
            ) : null}
            {notice ? <p className="mt-4 rounded-xl bg-[#fff7e8] px-4 py-3 text-sm font-bold text-[#805526]">{notice}</p> : null}
          </section>
        ) : (
          <div className="space-y-6">
            {membersData ? (
              <>
                <section className="grid gap-4 sm:grid-cols-3">
                  <MetricCard label="전체 회원" value={`${formatNumber(membersData.summary.members)}명`} accent="green" />
                  <MetricCard label="저장 레시피" value={`${formatNumber(membersData.summary.savedRecipes)}개`} accent="orange" />
                  <MetricCard label="OpenAI 신규 추출" value={`${formatNumber(membersData.summary.aiGeneratedRecipes)}개`} accent="blue" />
                </section>
                <p className="-mt-3 text-right text-xs font-bold leading-5 text-[#84938d]">
                  OpenAI 신규 추출은 캐시에 보관된 고유 AI 생성 결과 기준입니다.
                </p>

                <section className="overflow-hidden rounded-[28px] border border-[#d9e3da] bg-white shadow-[0_16px_48px_rgba(48,73,62,0.08)]">
                  <div className="flex flex-col gap-2 border-b border-[#e4ebe4] px-6 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
                    <div>
                      <p className="text-sm font-black tracking-[0.14em] text-[#397565]">MEMBERS</p>
                      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[#24493f]">회원별 이용 현황</h2>
                    </div>
                    <p className="text-xs font-bold leading-5 text-[#84938d]">
                      추출 이용은 캐시 재사용을 포함한 누적 성공 횟수입니다.
                    </p>
                  </div>

                  {membersNotice ? (
                    <p className="m-6 rounded-2xl bg-[#fff5ef] px-4 py-5 text-sm font-bold text-[#965b48] sm:m-8">
                      {membersNotice}
                    </p>
                  ) : (
                    <div className={`overflow-x-auto transition-opacity ${membersLoading ? "opacity-55" : "opacity-100"}`}>
                      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                        <thead className="bg-[#f4f7f2] text-xs font-black tracking-[0.08em] text-[#6e8179]">
                          <tr>
                            <th className="px-6 py-4 sm:px-8">닉네임</th>
                            <th className="px-4 py-4">이메일</th>
                            <th className="px-4 py-4">가입일</th>
                            <th className="px-4 py-4 text-center">저장 레시피</th>
                            <th className="px-4 py-4 text-center">추출 이용</th>
                            <th className="px-6 py-4 sm:px-8">최근 로그인</th>
                          </tr>
                        </thead>
                        <tbody>
                          {membersData.members.map((member) => (
                            <tr key={member.id} className="border-t border-[#edf1ec] text-[#50655d]">
                              <td className="px-6 py-4 font-black text-[#2e5147] sm:px-8">{member.nickname}</td>
                              <td className="px-4 py-4 font-extrabold text-[#5d746b]">{member.email}</td>
                              <td className="px-4 py-4 whitespace-nowrap">{formatKoreanDateTime(member.joinedAt)}</td>
                              <td className="px-4 py-4 text-center font-black text-[#397565]">{formatNumber(member.savedRecipeCount)}</td>
                              <td className="px-4 py-4 text-center font-black text-[#df684b]">{formatNumber(member.extractionCount)}</td>
                              <td className="px-6 py-4 whitespace-nowrap sm:px-8">{formatOptionalDateTime(member.lastSignInAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {!membersData.members.length ? (
                        <p className="px-6 py-10 text-center text-sm font-bold text-[#708179]">가입한 회원이 없습니다.</p>
                      ) : null}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 border-t border-[#e4ebe4] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <p className="text-xs font-bold text-[#7c8d86]">
                      전체 {formatNumber(membersData.pagination.totalItems)}명 · {membersData.pagination.page} / {membersData.pagination.totalPages} 페이지
                    </p>
                    <div className="flex flex-wrap items-center gap-2" aria-label="회원 목록 페이지 이동">
                      <PaginationButton
                        disabled={membersLoading || membersData.pagination.page <= 1}
                        onClick={() => setMemberPage((current) => Math.max(current - 1, 1))}
                      >
                        이전
                      </PaginationButton>
                      {getVisiblePages(membersData.pagination.page, membersData.pagination.totalPages).map((page) => (
                        <PaginationButton
                          key={page}
                          active={page === membersData.pagination.page}
                          disabled={membersLoading}
                          onClick={() => setMemberPage(page)}
                        >
                          {page}
                        </PaginationButton>
                      ))}
                      <PaginationButton
                        disabled={membersLoading || membersData.pagination.page >= membersData.pagination.totalPages}
                        onClick={() => setMemberPage((current) => Math.min(current + 1, membersData.pagination.totalPages))}
                      >
                        다음
                      </PaginationButton>
                    </div>
                  </div>
                </section>
              </>
            ) : membersLoading ? (
              <AdminMessage>회원 현황을 불러오고 있습니다.</AdminMessage>
            ) : membersNotice ? (
              <AdminMessage tone="error">{membersNotice}</AdminMessage>
            ) : null}

            {loading && !data ? (
              <AdminMessage>OpenAI 비용 정보를 불러오고 있습니다.</AdminMessage>
            ) : notice ? (
              <AdminMessage tone="error">{notice}</AdminMessage>
            ) : data ? (
              <>
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
              </>
            ) : null}
          </div>
        )}
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

function PaginationButton({
  children,
  active = false,
  disabled = false,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-9 min-w-9 rounded-lg px-3 text-xs font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-[#397565] text-white"
          : "border border-[#d4dfd6] bg-[#f8faf6] text-[#536b62] hover:bg-[#eaf2eb]"
      }`}
    >
      {children}
    </button>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatKoreanDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(`${value}T00:00:00Z`));
}

function formatKoreanDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function formatOptionalDateTime(value: string | null) {
  return value ? formatKoreanDateTime(value) : "로그인 기록 없음";
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
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

async function requestMembers(accessToken: string, page: number, signal?: AbortSignal) {
  const response = await fetch(`/api/admin/members?page=${page}`, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  const result = (await response.json()) as AdminMembersData & { error?: string };

  if (!response.ok) {
    throw new Error(result.error ?? "회원 현황을 불러오지 못했습니다.");
  }

  return result;
}
