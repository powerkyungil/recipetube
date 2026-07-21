# 레시담 (RecipeTube)

YouTube Shorts 속 요리 정보를 재료와 조리 순서로 정리하고, 나만의 레시피 냉장고에 보관하는 웹 서비스입니다.

레시담은 영상의 자막을 OpenAI로 구조화합니다. 영상에 없는 계량이나 조리법은 임의로 만들지 않고, 추정 사항과 주의 문구를 결과에 함께 표시합니다.

## 주요 기능

- YouTube Shorts URL 검증 및 한국어·영어 자막 수집
- OpenAI Structured Outputs를 이용한 재료, 분량, 조리 순서, 난이도 추출
- 추출 근거와 신뢰도, 가정 및 주의 사항 표시
- 동일 영상의 분석 결과 캐싱
- Supabase 이메일 OTP 로그인 및 개인별 레시피 보관
- 레시피 직접 작성, 수정, 삭제 및 원본 Shorts 다시 보기
- 계정 닉네임 변경 및 회원 탈퇴
- 회원·저장·추출 현황과 OpenAI 비용을 확인하는 관리자 화면
- 검색 엔진용 메타데이터, `robots.txt`, `sitemap.xml`, 구조화 데이터 제공

> 현재 실제 레시피 추출은 로그인한 사용자만 이용할 수 있으며, KST 기준 매월 10회 제공됩니다. 비로그인 사용자는 예시 결과를 미리 볼 수 있습니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프레임워크 | Next.js 16 App Router, React 19, TypeScript 5 |
| 스타일 | Tailwind CSS 4 |
| 인증·데이터베이스 | Supabase Auth, PostgreSQL, Row Level Security |
| AI | OpenAI Responses API (`gpt-5.4-mini`) |
| 영상 정보 | YouTube oEmbed, `youtube-transcript` |
| 유효성 검사 | Zod 4 |

## 시작하기

### 1. 요구 사항

- Node.js 20.9 이상
- npm
- Supabase 프로젝트
- OpenAI API 키

### 2. 설치

```bash
git clone <repository-url>
cd recipetube
npm install
```

### 3. 환경 변수 설정

`.env.example`을 복사해 `.env.local`을 만들고 아래 값을 설정합니다.

```bash
cp .env.example .env.local
```

```dotenv
# 공개 사이트 주소: canonical URL, robots.txt, sitemap.xml에 사용
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>

# 레시피 생성
OPENAI_API_KEY=<openai-api-key>

# 관리자 계정: 쉼표로 여러 이메일 지정 가능
ADMIN_EMAILS=admin@example.com

# 관리자 비용 대시보드에서만 사용 (선택)
OPENAI_ADMIN_KEY=<openai-admin-key>
OPENAI_CREDIT_TOTAL_USD=100
OPENAI_CREDIT_GRANTED_AT=2026-01-01
OPENAI_CREDIT_EXPIRES_AT=2026-12-31
```

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 권장 | 배포된 서비스의 origin. 미설정 시 `http://localhost:3000`을 사용합니다. |
| `NEXT_PUBLIC_SUPABASE_URL` | 예 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 예 | 브라우저 로그인과 사용자 권한 DB 요청에 사용하는 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 예 | 서버 API에서 인증·DB 관리에 사용하는 비밀 키 |
| `OPENAI_API_KEY` | 예 | 자막을 레시피 JSON으로 변환하는 프로젝트 API 키 |
| `ADMIN_EMAILS` | 관리자 기능 | `/admin` 접근을 허용할 이메일 목록 |
| `OPENAI_ADMIN_KEY` | 비용 현황 | OpenAI Organization Costs API 조회용 관리자 키 |
| `OPENAI_CREDIT_TOTAL_USD` | 비용 현황 | 지급된 전체 크레딧(USD) |
| `OPENAI_CREDIT_GRANTED_AT` | 비용 현황 | 크레딧 지급일 (`YYYY-MM-DD`) |
| `OPENAI_CREDIT_EXPIRES_AT` | 비용 현황 | 크레딧 만료일 (`YYYY-MM-DD`) |

`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENAI_ADMIN_KEY`는 브라우저에 노출하거나 `NEXT_PUBLIC_` 접두사를 붙이지 마세요. `.env.local`도 저장소에 커밋하지 않습니다.

### 4. Supabase 설정

Supabase Dashboard의 **SQL Editor**에서 [`supabase/schema.sql`](./supabase/schema.sql)을 실행합니다. 다음 테이블과 RLS 정책이 생성됩니다.

| 테이블 | 용도 |
| --- | --- |
| `usage_records` | 사용자별 월간 추출 횟수 |
| `video_cache` | Shorts 자막과 AI 분석 결과 캐시 |
| `saved_recipes` | 사용자가 저장하거나 직접 작성한 레시피 |
| `profiles` | 사용자 닉네임 |

이메일 로그인은 8자리 OTP 방식을 사용합니다. Supabase Dashboard에서 **Authentication → Email Templates → Magic Link**로 이동해 제목과 본문을 [`supabase/email-otp-template.html`](./supabase/email-otp-template.html) 내용으로 변경하세요. 자세한 설정은 [`supabase/README.md`](./supabase/README.md)를 참고합니다.

### 5. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 앱을 확인할 수 있습니다.

## 사용 흐름

1. 이메일로 받은 8자리 인증번호를 입력해 로그인합니다.
2. `/extract`에서 자막이 제공되는 YouTube Shorts URL을 입력합니다.
3. 추출된 재료, 조리 단계, 추정 사항과 주의 문구를 확인합니다.
4. 결과를 나의 냉장고에 저장하거나 `/fridge`에서 레시피를 직접 작성합니다.
5. 저장한 레시피를 수정·삭제하거나 원본 Shorts를 다시 확인합니다.

일반 YouTube 영상 URL은 지원하지 않습니다. 자막이 없거나 비공개·삭제된 Shorts도 분석할 수 없습니다. 동일한 영상을 다시 요청하면 캐시된 결과를 사용하지만, 성공한 요청은 캐시 여부와 관계없이 월간 사용량에 포함됩니다.

## 주요 경로

| 경로 | 설명 |
| --- | --- |
| `/` | 서비스 소개와 이용 방법 |
| `/extract` | Shorts 레시피 추출, 로그인, 저장 |
| `/fridge` | 저장한 레시피 목록 및 직접 작성·수정·삭제 |
| `/account` | 닉네임 변경 및 회원 탈퇴 |
| `/guides` | 레시피 추출·보관 활용 가이드 |
| `/admin` | 허용된 관리자용 회원 및 OpenAI 비용 현황 |

## API

| 메서드 | 엔드포인트 | 설명 |
| --- | --- | --- |
| `GET` | `/api/recipes/extract` | 로그인 사용자의 이번 달 추출 사용량 조회 |
| `POST` | `/api/recipes/extract` | Shorts 자막을 레시피로 변환 |
| `GET` | `/api/recipes` | 로그인 사용자의 저장 레시피 목록 조회 |
| `POST` | `/api/recipes` | 레시피 직접 작성 |
| `POST` | `/api/recipes/save` | 추출 결과 저장 |
| `PATCH` | `/api/recipes/:id` | 저장 레시피 수정 |
| `DELETE` | `/api/recipes/:id` | 저장 레시피 삭제 |
| `GET` | `/api/account` | 계정 프로필 조회 |
| `PATCH` | `/api/account` | 닉네임 변경 |
| `DELETE` | `/api/account` | 레시피·사용량·인증 계정 삭제 |
| `GET` | `/api/admin/members` | 회원·저장·추출 통계 조회 |
| `GET` | `/api/admin/openai-costs` | OpenAI 크레딧과 비용 조회 |

인증이 필요한 API는 Supabase access token을 `Authorization: Bearer <token>` 헤더로 전달합니다.

## 프로젝트 구조

```text
recipetube/
├── public/                    # 정적 파일
├── src/
│   ├── app/                   # App Router 페이지, 레이아웃, Route Handlers
│   │   ├── api/               # 계정·레시피·관리자 API
│   │   ├── account/           # 계정 관리
│   │   ├── admin/             # 관리자 대시보드
│   │   ├── extract/           # Shorts 레시피 추출
│   │   ├── fridge/            # 나의 레시피 냉장고
│   │   └── guides/            # 활용 가이드
│   ├── components/            # 공통 헤더, 푸터, 계정 삭제 UI
│   ├── lib/                   # OpenAI, YouTube, Supabase, 사용량 로직
│   └── types/                 # 레시피 도메인 타입
└── supabase/                  # DB 스키마와 이메일 OTP 템플릿
```

## 명령어

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드 생성 |
| `npm run start` | 생성된 프로덕션 빌드 실행 |
| `npm run lint` | ESLint 검사 |

배포 전에는 다음 명령으로 정적 검사와 빌드를 확인합니다.

```bash
npm run lint
npm run build
```

## 배포

Next.js를 실행할 수 있는 플랫폼에 배포할 수 있습니다. 배포 환경에는 `.env.local`과 동일한 서버 환경 변수를 등록하고, `NEXT_PUBLIC_SITE_URL`을 실제 HTTPS origin으로 설정하세요.

Supabase의 서비스 역할 키와 OpenAI 키는 반드시 서버 측 비밀 값으로 관리해야 합니다. 관리자 화면을 사용하지 않는 경우 `ADMIN_EMAILS`와 `OPENAI_*` 비용 관련 변수는 생략할 수 있습니다. 단, 레시피 생성에 필요한 `OPENAI_API_KEY`는 생략할 수 없습니다.
