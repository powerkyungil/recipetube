"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AccountDeletionDialog } from "@/components/account-deletion-dialog";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const navigation = [
  { href: "/", label: "메인" },
  { href: "/fridge", label: "나의 냉장고" },
  { href: "/extract", label: "레시피 추출" },
];

type AccountProfile = {
  nickname: string;
  email: string;
};

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const deletionAccessToken = session?.access_token ?? "";
  const deletionEmail = profile?.email ?? session?.user.email ?? "";

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let active = true;

    async function loadProfile(nextSession: Session | null) {
      if (!nextSession?.access_token) {
        if (active) {
          setProfile(null);
        }
        return;
      }

      try {
        const response = await fetch("/api/account", {
          headers: { authorization: `Bearer ${nextSession.access_token}` },
          cache: "no-store",
        });
        const result = (await response.json()) as { profile?: AccountProfile };
        if (active && response.ok && result.profile) {
          setProfile(result.profile);
        }
      } catch {
        // 메뉴는 로그인 상태 그대로 두고 프로필 로드만 다음 요청에서 재시도한다.
      }
    }

    const initialize = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSession(data.session);
      }
      void loadProfile(data.session);
    };
    void initialize();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setMenuOpen(false);
      void loadProfile(nextSession);
    });
    const refreshProfile = () => {
      void supabase.auth.getSession().then(({ data }) => loadProfile(data.session));
    };
    window.addEventListener("account-profile-updated", refreshProfile);

    return () => {
      active = false;
      data.subscription.unsubscribe();
      window.removeEventListener("account-profile-updated", refreshProfile);
    };
  }, [supabase]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  async function signOut() {
    await supabase?.auth.signOut();
    setMenuOpen(false);
    router.push("/");
  }

  async function handleDeleted() {
    await supabase?.auth.signOut();
    setDeleting(false);
    setMenuOpen(false);
    router.replace("/");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[#dfe7dd] bg-[#f8faf4]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="레시담 메인으로 이동">
          <span className="fridge-shine flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#397565] text-white shadow-[0_6px_18px_rgba(45,94,80,0.18)]">
            <FridgeLogoIcon className="h-6 w-6" />
          </span>
          <span className="hidden min-[380px]:block">
            <span className="block text-xl font-black tracking-[-0.05em] text-[#214a40]">레시담</span>
            <span className="hidden text-[10px] font-medium text-[#7d8e87] sm:block">레시피를 담는 나만의 냉장고</span>
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
          <nav aria-label="주요 메뉴" className="flex min-w-0 items-center gap-0.5 rounded-2xl bg-[#edf3eb] p-1 sm:gap-1">
            {navigation.map((item) => {
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-xl px-2 py-2 text-[11px] font-bold transition min-[380px]:px-2.5 min-[380px]:text-xs sm:px-4 sm:text-sm ${
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

          {session ? (
            <div ref={menuRef} className="relative shrink-0">
              <button type="button" onClick={() => setMenuOpen((current) => !current)} aria-expanded={menuOpen} aria-haspopup="menu" className="flex h-10 max-w-[94px] items-center gap-1 rounded-xl border border-[#cfe0d7] bg-white px-2 text-xs font-extrabold text-[#356457] shadow-sm transition hover:bg-[#f4f8f4] min-[380px]:max-w-[120px] sm:max-w-[160px] sm:px-3 sm:text-sm">
                <span className="min-w-0 truncate">{profile?.nickname ?? "내 계정"}</span>
                <span aria-hidden="true" className="text-[10px] text-[#779087]">▾</span>
              </button>
              {menuOpen ? (
                <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-[#d8e4dc] bg-white p-2 shadow-[0_16px_40px_rgba(38,73,62,0.18)]">
                  <div className="border-b border-[#edf1ec] px-3 py-2.5">
                    <p className="truncate text-sm font-black text-[#2f5d50]">{profile?.nickname ?? "닉네임을 준비하고 있어요"}</p>
                    <p className="mt-1 truncate text-xs font-medium text-[#768980]">{profile?.email ?? session.user.email}</p>
                  </div>
                  <Link href="/account" role="menuitem" onClick={() => setMenuOpen(false)} className="mt-1 block rounded-xl px-3 py-2.5 text-sm font-bold text-[#4c675d] transition hover:bg-[#edf5ef]">
                    계정 관리
                  </Link>
                  <button type="button" role="menuitem" onClick={signOut} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#4c675d] transition hover:bg-[#edf5ef]">
                    로그아웃
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); setDeleting(true); }} className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[#cf5e42] transition hover:bg-[#fff1ed]">
                    회원 탈퇴
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {deleting && deletionAccessToken && deletionEmail ? (
        <AccountDeletionDialog accessToken={deletionAccessToken} email={deletionEmail} onClose={() => setDeleting(false)} onDeleted={handleDeleted} />
      ) : null}
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
