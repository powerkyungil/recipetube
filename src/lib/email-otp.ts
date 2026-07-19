export const EMAIL_OTP_LENGTH = 8;

export function normalizeEmailOtp(value: string) {
  return value.replace(/\D/g, "").slice(0, EMAIL_OTP_LENGTH);
}

export function formatEmailOtpError(message: string) {
  if (/email rate limit|over_email_send_rate_limit/i.test(message)) {
    return "로그인 메일을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.";
  }

  if (/rate limit|too many requests/i.test(message)) {
    return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  }

  if (/otp_expired|token.*expired|expired.*token/i.test(message)) {
    return "인증번호가 만료되었어요. 새 인증번호를 받아 다시 시도해 주세요.";
  }

  if (/invalid.*(?:otp|token)|(?:otp|token).*invalid/i.test(message)) {
    return "인증번호가 올바르지 않아요. 이메일의 숫자를 다시 확인해 주세요.";
  }

  return message;
}
