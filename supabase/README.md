# Supabase 이메일 OTP 설정

모바일 메일 앱의 내부 브라우저가 아닌, 로그인을 시작한 브라우저에 세션을 저장하기 위해 이메일 인증번호 방식을 사용합니다.

1. Supabase Dashboard에서 프로젝트를 엽니다.
2. **Authentication → Email Templates → Magic Link**로 이동합니다.
3. 제목을 `[레시담] 로그인 인증번호가 도착했어요`로 변경합니다.
4. 본문을 [`email-otp-template.html`](./email-otp-template.html)의 내용으로 교체합니다.
5. 본문에 `{{ .ConfirmationURL }}`이 남아 있지 않고 `{{ .Token }}`이 포함되어 있는지 확인한 뒤 저장합니다.

현재 프로젝트의 이메일 OTP 길이는 8자리이며, 애플리케이션 입력 검증도 같은 길이를 사용합니다.

이 대시보드 설정이 적용되지 않으면 Supabase가 인증번호 대신 기존 로그인 링크를 보냅니다.
