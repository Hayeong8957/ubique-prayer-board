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
