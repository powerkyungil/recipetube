"use client";

import { useState } from "react";

type AccountDeletionDialogProps = {
  accessToken: string;
  email: string;
  onClose: () => void;
  onDeleted: () => Promise<void> | void;
};

export function AccountDeletionDialog({
  accessToken,
  email,
  onClose,
  onDeleted,
}: AccountDeletionDialogProps) {
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (confirmationEmail.trim().toLowerCase() !== email.toLowerCase()) {
      setError("가입한 이메일을 정확히 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ confirmationEmail }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? "회원 탈퇴를 완료하지 못했습니다.");
      }

      await onDeleted();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "회원 탈퇴를 완료하지 못했습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#16362d]/45 p-4 sm:items-center" role="presentation">
      <section aria-modal="true" aria-labelledby="delete-account-title" role="dialog" className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(22,54,45,0.26)] sm:p-7">
        <p className="text-xs font-black tracking-[0.14em] text-[#df684b]">ACCOUNT DELETE</p>
        <h2 id="delete-account-title" className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#24493f]">정말 탈퇴할까요?</h2>
        <p className="mt-3 text-sm leading-6 text-[#657a71]">
          저장한 레시피와 이용 기록이 모두 삭제되며 되돌릴 수 없습니다.
        </p>

        <form onSubmit={deleteAccount} className="mt-5">
          <label className="block text-sm font-extrabold text-[#3f5e54]" htmlFor="delete-confirmation-email">
            아래 이메일을 입력해 탈퇴를 확인해 주세요
          </label>
          <p className="mt-1 text-sm font-bold text-[#397565]">{email}</p>
          <input
            id="delete-confirmation-email"
            value={confirmationEmail}
            onChange={(event) => setConfirmationEmail(event.target.value)}
            type="email"
            autoComplete="email"
            className="mt-3 w-full rounded-xl border border-[#cbdad1] bg-[#fbfcf9] px-4 py-3 text-sm text-[#24493f] outline-none transition focus:border-[#397565] focus:ring-4 focus:ring-[#dcece5]"
            placeholder="가입한 이메일 입력"
            disabled={loading}
          />
          {error ? <p className="mt-3 text-sm font-bold text-[#d85d45]">{error}</p> : null}
          <div className="mt-6 flex gap-2">
            <button type="button" onClick={onClose} disabled={loading} className="min-h-11 flex-1 rounded-xl border border-[#cbdad1] bg-white px-4 text-sm font-extrabold text-[#617970] transition hover:bg-[#f3f7f2] disabled:cursor-not-allowed disabled:opacity-50">
              취소
            </button>
            <button type="submit" disabled={loading || confirmationEmail.trim().toLowerCase() !== email.toLowerCase()} className="min-h-11 flex-1 rounded-xl bg-[#df684b] px-4 text-sm font-extrabold text-white transition hover:bg-[#c95b42] disabled:cursor-not-allowed disabled:opacity-45">
              {loading ? "탈퇴 처리 중..." : "회원 탈퇴"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
