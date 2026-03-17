# Ubique Prayer Board

김지용셀(B그룹) 중심으로 시작해서, 추후 교회 구성원 전체로 확장 가능한 기도제목/말씀 게시판 서비스입니다.

## 핵심 목표

- 로그인 사용자: 게시글/댓글 작성, 수정, 삭제
- 비로그인 사용자: 게시글/댓글 조회
- 익명 작성 지원(체크박스 기반)
- 관리자 고정글(`is_pinned`) 지원
- 프로필에서 과거 기도제목 목록 확인

## 기술 스택

- Frontend: Next.js (Pages Router)
- UI: shadcn/ui + Tailwind CSS
- Auth: NextAuth.js + Kakao OAuth
- PWA: next-pwa
- Backend: Next.js API Routes (BFF)
- DB: Supabase PostgreSQL
- Realtime: Supabase Realtime (댓글 스트림)
- Deploy: Vercel

## 문서

- MVP 설계/로드맵: [docs/mvp-plan.md](./docs/mvp-plan.md)
- DB 스키마(SQL): [supabase/schema.sql](./supabase/schema.sql)
- DB 마이그레이션 가이드(v1 -> v2): [docs/supabase-migration-runbook.md](./docs/supabase-migration-runbook.md)

## 폴더 구조

`client/src`는 라우팅 진입점, 도메인 로직, 공용 인프라, 재사용 UI를 분리하는 기준으로 구성한다.

```text
client/src
├── components/
│   ├── auth/
│   ├── posts/
│   └── ui/
├── features/
│   ├── auth/
│   └── posts/
├── lib/
│   ├── auth/
│   └── supabase/
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   ├── boards/
│   │   ├── health/
│   │   ├── me/
│   │   └── posts/
│   ├── prayers/
│   └── sermons/
├── styles/
└── types/
```

### 구조 원칙

- `pages/`: Next.js Pages Router의 화면 진입점이다. URL과 직접 연결되는 페이지 파일만 둔다.
  프론트엔드 영역이다.
- `pages/api/`: Next.js API Route 진입점이다. HTTP 요청/응답을 처리하고 실제 비즈니스 로직은 `features/`로 위임한다.
  현재 MVP에서는 백엔드 영역이다.
- `features/`: 인증, 게시글처럼 기능 단위의 도메인 로직을 둔다. DB 조회, 생성, 수정, 삭제 규칙과 기능별 타입을 함께 관리한다.
  현재는 백엔드 성격이 더 강하지만, 서비스 분리 이후에는 프론트/백엔드 각각의 도메인 계층으로 재편할 수 있다.
- `lib/`: 특정 기능에 속하지 않는 공용 인프라 코드를 둔다. 예를 들어 NextAuth 설정, Supabase 클라이언트, 범용 유틸리티가 여기에 들어간다.
  프론트와 백엔드가 함께 사용하는 인프라 성격의 영역이다.
- `components/`: 여러 페이지에서 재사용하는 UI 컴포넌트를 둔다.
  프론트엔드 영역이다.
- `components/ui/`: 기능에 중립적인 공용 UI 조각을 둔다.
  프론트엔드 영역이다.
- `components/auth/`: 인증 흐름에서만 쓰는 UI처럼 특정 기능에 가까운 재사용 컴포넌트를 둔다.
  프론트엔드 영역이다.
- `components/posts/`: 게시글 상세나 댓글처럼 게시글 도메인에 가까운 재사용 UI를 둔다.
  프론트엔드 영역이다.
- `styles/`: 전역 스타일과 디자인 토큰을 둔다.
  프론트엔드 영역이다.
- `types/`: `next-auth`, `next-pwa`처럼 외부 라이브러리 타입 확장 선언을 둔다.
  프론트엔드와 백엔드 모두에서 참고할 수 있는 공용 타입 보강 영역이다.

### 현재 구조를 프론트/백엔드 관점에서 보면

- 프론트엔드: `pages/`, `components/`, `styles/`
- 백엔드: `pages/api/`, `features/`
- 공용 인프라: `lib/`, `types/`

현재 MVP는 Next.js 한 프로젝트 안에서 프론트와 백엔드를 같이 운영하는 풀스택 구조다.  
서비스가 커져 프론트/백엔드를 분리할 경우, `pages/`와 `components/`, `styles/`는 프론트 앱으로 이동하고, `pages/api/`와 서버 중심의 `features/`, `lib/` 일부는 백엔드 서비스로 이동하는 방향을 기본 전제로 한다.

### 현재 디렉터리 설명

- `components/ui`: `Button`, `Card` 같은 프리미티브 UI 컴포넌트
- `components/auth`: 로그인 필요 모달 등 인증 관련 UI
- `components/posts`: 게시글 상세에서 공통으로 쓰는 댓글 UI
- `features/auth`: 카카오 로그인 사용자 동기화 같은 인증 도메인 로직
- `features/posts`: 게시글/댓글 조회와 게시판 도메인 타입
- `lib/auth`: NextAuth 옵션과 인증 설정
- `lib/supabase`: 클라이언트/서버 런타임별 Supabase 연결
- `pages/prayers`: 기도제목 상세/작성 페이지
- `pages/sermons`: 주일 말씀 상세/작성 페이지
- `pages/api/posts`: 게시글, 댓글, 아멘 관련 API 엔드포인트
- `pages/api/me`: 내 게시글 조회 API
- `pages/api/boards`: 게시판 메타 정보 API
- `pages/api/health`: 인프라 상태 확인용 API

### 문서 관리 규칙

- `client/src` 하위의 폴더 구조나 책임이 바뀌면 이 README의 `폴더 구조` 섹션도 같이 수정한다.
- 새 폴더를 추가할 때는 "왜 분리했는지"까지 함께 적는다. 단순 트리 나열만 하지 않는다.
- `pages/` 아래에 기능 로직을 직접 늘리기 전에 `features/` 또는 `lib/`로 분리 가능한지 먼저 검토한다.

## 백엔드 분리 기준

### 분리를 고려하는 시점

- API 수가 많아져 `pages/api/` 관리 비용이 커질 때
- 인증, 게시글, 댓글, 알림 등 도메인이 늘어나 서버 책임이 복잡해질 때
- 배포 주기를 프론트와 백엔드에서 분리해야 할 때
- 관리자 기능, 배치 작업, 비동기 이벤트 처리, 외부 연동이 본격적으로 늘어날 때

### 분리 시 추천 백엔드 프레임워크

우선 추천은 `NestJS`다.

- 이유 1: 현재 구조가 이미 `auth`, `posts` 같은 기능 단위로 나뉘어 있어서, NestJS의 모듈 기반 구조로 옮기기 쉽다.
- 이유 2: 인증, DTO, Validation, Guard, Interceptor, 테스트 구조까지 한 프레임 안에서 일관되게 가져가기 좋다.
- 이유 3: 팀 규모가 커질수록 Express 단독 구성보다 구조 강제가 있어서 유지보수에 유리하다.
- 참고: [NestJS Overview](https://docs.nestjs.com/)

성능과 단순성을 더 우선하면 `Fastify`도 좋은 선택지다.

- 이유 1: 공식 문서 기준으로 고성능 Node.js 웹 프레임워크를 지향한다.
- 이유 2: BFF보다 독립 API 서버에 가까운 구조를 만들 때 가볍게 시작하기 좋다.
- 이유 3: 다만 프로젝트 규칙을 직접 정해야 해서, 기능이 커질수록 아키텍처 일관성은 팀이 관리해야 한다.
- 참고: [Fastify Documentation](https://fastify.dev/docs/latest/)

`Express`는 가장 익숙하고 자료가 많지만, 이 프로젝트의 다음 단계 기본 추천은 아니다.

- 이유 1: 자유도가 높아서 빠르게 시작할 수 있다.
- 이유 2: 대신 규모가 커질수록 폴더 구조, 검증, 에러 처리, 모듈 경계를 팀이 직접 통제해야 한다.
- 참고: [Express Documentation](https://expressjs.com/)

### 현재 프로젝트 기준 권장안

- 1순위: `NestJS`
- 2순위: `Fastify`
- 3순위: `Express`

현재처럼 인증, 게시글, 댓글, 사용자 프로필 중심의 서비스가 커질 가능성이 있다면 `NestJS`가 가장 무난하다.  
지금 `features/auth`, `features/posts`로 나눈 사고방식을 유지한 채 `auth module`, `posts module` 식으로 확장하기 쉽기 때문이다.

## 권장 개발 순서

1. Supabase 프로젝트 생성 후 `supabase/schema.sql` 실행
2. Next.js 프로젝트 초기화 (Pages Router)
3. Tailwind + shadcn/ui 기본 세팅
4. NextAuth Kakao 로그인 구성
5. PWA 설정(`next-pwa`, manifest, 아이콘, 오프라인 fallback)
6. 게시글 CRUD API + 화면 구현
7. 댓글 CRUD + Realtime 구독 연결
8. 프로필 페이지(내 과거 기도제목 목록) 구현
9. Vercel 배포 및 환경변수 세팅
