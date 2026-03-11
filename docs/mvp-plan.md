# MVP 설계 및 실행 계획

## 1) MVP 범위

### 포함

- 카카오 OAuth 로그인 (NextAuth)
- PWA 기본 적용(`next-pwa`, manifest, install 가능 상태)
- 기도제목 게시판 CRUD
- 댓글 CRUD
- 익명 작성(게시글/댓글)
- 고정글(`is_pinned`) 정렬 지원
- 주일 말씀 게시판(게시글 중심)
- 로그인 시 프로필 탭 노출 + 내 과거 기도제목 목록

### 제외(배포 후)

- 욕설/스팸 필터
- 푸시/이메일 알림
- 출석체크 알림
- 구글 OAuth

## 2) 페이지 구조 (Pages Router)

- `/` : 기도제목 목록(고정글 우선)
- `/prayers/[id]` : 기도제목 상세 + 댓글
- `/prayers/new` : 기도제목 작성(로그인 필요)
- `/prayers/[id]/edit` : 기도제목 수정(작성자만)
- `/sermons` : 주일 말씀 목록
- `/sermons/[id]` : 주일 말씀 상세
- `/sermons/new` : 주일 말씀 작성(로그인 필요, 초기엔 셀 리더만 운영)
- `/profile` : 내 과거 기도제목 목록(로그인 필요)
- `/login` : 카카오 로그인 유도 화면

## 3) API 라우트 초안

- `GET /api/posts?boardType=prayer|sermon`
- `GET /api/posts/:id`
- `POST /api/posts` (로그인)
- `PATCH /api/posts/:id` (작성자)
- `DELETE /api/posts/:id` (작성자)
- `GET /api/posts/:id/comments`
- `POST /api/posts/:id/comments` (로그인)
- `PATCH /api/comments/:id` (작성자)
- `DELETE /api/comments/:id` (작성자)
- `GET /api/me/posts?boardType=prayer` (로그인)

## 4) 권한/익명 처리 원칙

- 조회: 비로그인 허용
- 작성/수정/삭제: 로그인 필요
- 작성자 검증: `session.user.id`와 `author_user_id` 비교
- 익명 체크 시 응답에서 작성자명은 `"익명"`으로 노출
- DB에는 실제 작성자 ID를 항상 보관(권한 검증용)

## 5) Realtime 적용 범위

- 댓글 목록 실시간 반영(해당 post_id 채널 구독)
- 쓰기 작업은 API Routes에서만 수행
- 브라우저 클라이언트는 조회/구독 위주

## 6) 일정(4.5주)

1. 0.5주: 요구사항 확정 + DB 스키마 확정
2. 0.5주: Next.js + Tailwind/shadcn + NextAuth/Kakao + PWA 기본 세팅
3. 1주: 기도제목 CRUD + 리스트/상세 UI
4. 1주: 댓글 CRUD + 익명 기능 + Realtime
5. 0.5주: 프로필(내 과거 기도제목)
6. 1주: 테스트/디버깅/배포

## 7) 리스크와 대응

- Kakao OAuth 설정 지연: 개발/운영 Redirect URI를 초기에 분리 정의
- Realtime 권한 복잡도: 클라이언트는 읽기 구독만, 쓰기는 서버 API 강제
- PWA 캐시 이슈: API 응답은 네트워크 우선, 정적 리소스만 캐시 우선으로 분리
- 익명 악용: MVP에서는 간단 신고/숨김만 두고 필터링은 2차 개발
