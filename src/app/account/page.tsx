"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AccountDeletionDialog } from "@/components/account-deletion-dialog";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type AccountProfile = {
  id: string;
  nickname: string;
  email: string;
};

export default function AccountPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSession(data.session);
        if (!data.session) {
          setLoading(false);
        }
      }
    };
    void loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      return;
    }

    const controller = new AbortController();
    async function loadProfile() {
      setLoading(true);
      try {
        const response = await fetch("/api/account", {
          headers: { authorization: `Bearer ${accessToken}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as { profile?: AccountProfile; error?: string };
        if (!response.ok || !result.profile) {
          throw new Error(result.error ?? "계정 정보를 불러오지 못했습니다.");
        }
        setProfile(result.profile);
        setNickname(result.profile.nickname);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setMessage(error instanceof Error ? error.message : "계정 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }
    void loadProfile();
    return () => controller.abort();
  }, [session?.access_token]);

  async function saveNickname(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accessToken = session?.access_token;
    if (!accessToken) {
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ nickname }),
      });
      const result = (await response.json()) as { profile?: AccountProfile; error?: string };
      if (!response.ok || !result.profile) {
        throw new Error(result.error ?? "닉네임을 변경하지 못했습니다.");
      }
      setProfile(result.profile);
      setNickname(result.profile.nickname);
      window.dispatchEvent(new Event("account-profile-updated"));
      setMessage("닉네임을 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "닉네임을 변경하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleted() {
    await supabase?.auth.signOut();
    router.replace("/");
  }

  if (!supabase) {
    return <AccountMessage>로그인 서비스를 준비하지 못했습니다.</AccountMessage>;
  }

  if (!loading && !session) {
    return (
      <AccountMessage>
        로그인 후 계정을 관리할 수 있습니다. <Link href="/fridge" className="underline">로그인하러 가기</Link>
      </AccountMessage>
    );
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#f7faf4] px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-black tracking-[0.16em] text-[#397565]">MY ACCOUNT</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[#193c33] sm:text-5xl">계정 관리</h1>
        <p className="mt-3 text-sm leading-6 text-[#6a7f76] sm:text-base">레시담에서 사용할 닉네임을 관리할 수 있어요.</p>

        <section className="mt-8 rounded-[28px] border border-[#d7e4db] bg-white p-6 shadow-[0_16px_48px_rgba(48,73,62,0.08)] sm:p-8">
          {loading ? (
            <p className="text-sm font-bold text-[#71857c]">계정 정보를 불러오는 중입니다.</p>
          ) : (
            <form onSubmit={saveNickname} className="space-y-6">
              <div>
                <label htmlFor="nickname" className="block text-sm font-extrabold text-[#36594e]">닉네임</label>
                <input id="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={16} className="mt-2 w-full rounded-xl border border-[#cbdad1] bg-[#fbfcf9] px-4 py-3 text-base font-bold text-[#24493f] outline-none transition focus:border-[#397565] focus:ring-4 focus:ring-[#dcece5]" />
                <p className="mt-2 text-xs font-medium text-[#7e9088]">한글·영문·숫자 2~16자, 공백 없이 입력해 주세요.</p>
              </div>
              <div>
                <label htmlFor="account-email" className="block text-sm font-extrabold text-[#36594e]">이메일</label>
                <input id="account-email" value={profile?.email ?? session?.user.email ?? ""} readOnly className="mt-2 w-full cursor-default rounded-xl border border-[#d9e4dd] bg-[#f3f6f2] px-4 py-3 text-base font-bold text-[#71847b]" />
              </div>
              {message ? <p className="text-sm font-bold text-[#397565]">{message}</p> : null}
              <button type="submit" disabled={saving || !nickname.trim()} className="min-h-12 rounded-xl bg-[#397565] px-5 text-sm font-extrabold text-white transition hover:bg-[#2f6455] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? "저장 중..." : "닉네임 저장"}
              </button>
            </form>
          )}
        </section>

        {!loading && session?.access_token && profile?.email ? (
          <section className="mt-5 rounded-[24px] border border-[#f0cfc5] bg-[#fff9f7] p-6 sm:p-7">
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#a84b37]">회원 탈퇴</h2>
            <p className="mt-2 text-sm leading-6 text-[#8a6258]">저장한 레시피와 이용 기록을 모두 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p>
            <button type="button" onClick={() => setDeleting(true)} className="mt-4 min-h-10 rounded-xl border border-[#e1a697] bg-white px-4 text-sm font-extrabold text-[#cc5c43] transition hover:bg-[#fff3ef]">회원 탈퇴</button>
          </section>
        ) : null}
      </div>

      {deleting && session?.access_token && profile?.email ? (
        <AccountDeletionDialog accessToken={session.access_token} email={profile.email} onClose={() => setDeleting(false)} onDeleted={handleDeleted} />
      ) : null}
    </main>
  );
}

function AccountMessage({ children }: { children: React.ReactNode }) {
  return <main className="min-h-[calc(100vh-72px)] bg-[#f7faf4] px-5 py-16 text-center text-sm font-bold text-[#627a72]">{children}</main>;
}
