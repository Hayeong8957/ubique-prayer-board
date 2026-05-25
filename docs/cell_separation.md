# Cell Separation Design Draft

## 목적

현재 서비스는 특정 셀 중심으로 운영되고 있지만, 추후 A/B/C/청장년부 등 여러 그룹과 셀이 함께 사용할 수 있도록 확장해야 한다.  
이 문서는 그 확장을 위한 데이터 모델, 사용자 시나리오, 접근 제어 방향을 사전 검토용으로 정리한 문서다.

## 핵심 요구사항

1. 사용자에게 셀 정보를 입력받을 수 있어야 한다.
2. 회원가입 시 그룹과 셀을 선택할 수 있어야 한다.
3. 기존 가입 유저는 마이페이지에서 셀 정보를 수정할 수 있어야 한다.
4. 셀 정보 변경은 즉시 반복 변경되지 않도록 1주일 제한이 필요하다.
5. 게시판은 본인 셀의 기도제목만 볼 수 있어야 한다.
6. 그룹별 셀 목록은 DB에서 쉽게 관리할 수 있어야 한다.
7. 셀 리더 변경 등으로 셀 이름이 바뀌어도 DB 수정만으로 대응 가능해야 한다.

## 결론 요약

단순히 `users` 테이블에 문자열 컬럼으로 셀 이름을 저장하는 방식은 추천하지 않는다.  
그룹/셀을 마스터 테이블로 분리하고, `users`와 `posts`가 `cell_id`를 참조하는 구조로 가야 한다.

핵심 설계 포인트는 아래와 같다.

- `cell_groups` 테이블로 그룹 관리
- `cells` 테이블로 셀 관리
- `users.cell_id`로 현재 사용자 소속 셀 관리
- `posts.cell_id`로 게시글 작성 당시 소속 셀을 snapshot 저장
- `user_cell_change_logs`로 셀 변경 이력 관리
- 셀 변경 시 `1주일 쿨다운` 적용

## 추천 DB 구조

### 1. cell_groups

그룹 단위 정보를 저장하는 테이블

예시 컬럼:

- `id uuid primary key`
- `code text unique`
- `name text not null`
- `sort_order integer`
- `is_active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

예시 데이터:

- `A`
- `B`
- `C`
- `청장년부`

### 2. cells

실제 셀 단위를 저장하는 테이블

예시 컬럼:

- `id uuid primary key`
- `group_id uuid not null references cell_groups(id)`
- `leader_name text not null`
- `display_name text not null`
- `sort_order integer`
- `is_active boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

설명:

- 셀 이름이 셀리더명 기준이라면 `display_name`에 현재 노출명을 저장
- 리더 변경 시 이 테이블만 수정하면 됨
- 그룹별 드롭다운도 이 테이블에서 관리 가능

### 3. users 확장

현재 `users` 테이블에는 셀 관련 정보가 없다. 아래 컬럼 추가를 권장한다.

- `cell_id uuid references cells(id)`
- `cell_assigned_at timestamptz`
- `cell_updated_at timestamptz`
- `cell_change_locked_until timestamptz`

설명:

- `cell_id`: 현재 유저 소속 셀
- `cell_assigned_at`: 최초 셀 설정 시점
- `cell_updated_at`: 마지막 셀 변경 시점
- `cell_change_locked_until`: 이 시각 전까지는 셀 변경 불가

### 4. user_cell_change_logs

셀 변경 이력 저장용 테이블

예시 컬럼:

- `id uuid primary key`
- `user_id uuid not null references users(id)`
- `from_cell_id uuid references cells(id)`
- `to_cell_id uuid references cells(id)`
- `changed_at timestamptz not null default now()`
- `reason text`

설명:

- 유저가 셀을 언제 어떻게 바꿨는지 추적 가능
- 추후 관리자 감사 로그나 분쟁 대응에도 유리

### 5. posts 확장

게시글은 작성 시점의 셀을 별도로 저장해야 한다.

추가 권장 컬럼:

- `cell_id uuid not null references cells(id)`

이 컬럼이 중요한 이유:

- 유저가 나중에 셀을 변경해도 예전에 작성한 게시글은 원래 셀 소속으로 남아야 함
- 만약 `posts.cell_id` 없이 작성자 `users.cell_id`만 보고 필터링하면, 과거 글까지 새 셀로 이동하는 문제가 생김

## 사용자 시나리오

### 1. 신규 가입 유저

권장 흐름:

1. 카카오 로그인 성공
2. 사용자 기본 계정 생성 또는 갱신
3. `users.cell_id`가 비어 있으면 셀 선택 온보딩 화면으로 이동
4. 온보딩 화면에서 그룹 드롭다운 선택
5. 선택한 그룹 기준으로 셀 드롭다운 목록 노출
6. 셀 선택 후 저장
7. 저장 시 아래 컬럼 기록

- `users.cell_id`
- `users.cell_assigned_at`
- `users.cell_updated_at`
- `users.cell_change_locked_until = now() + interval '7 days'`

UI 관점:

- 한 행에 드롭다운 2개
- 첫 번째 드롭다운: 그룹
- 두 번째 드롭다운: 그룹에 속한 셀 목록

### 2. 기존 가입 유저

권장 흐름:

1. 마이페이지 진입
2. 현재 소속 그룹/셀 표시
3. 셀 정보 미기입 상태라면 언제든 최초 설정 가능
4. 이미 셀 정보가 있다면 변경 가능 여부 확인
5. `cell_change_locked_until` 이전이면 변경 버튼 비활성화 또는 안내 문구 노출
6. 가능 시 그룹/셀 재선택 후 저장
7. 저장 성공 시:

- `users.cell_id` 갱신
- `users.cell_updated_at = now()`
- `users.cell_change_locked_until = now() + interval '7 days'`
- `user_cell_change_logs`에 기록

## 셀 변경 제한 정책

요구사항 기준으로는 "1주일에 한 번만 변경 가능" 정책이 적절하다.

구현 규칙:

- `cell_id`가 없는 유저는 최초 1회 자유롭게 설정 가능
- `cell_id`가 이미 있는 유저는 `cell_change_locked_until` 이전에는 변경 불가
- 변경 성공 시 다음 변경 가능 시점을 1주일 뒤로 설정

예시 안내 문구:

- `다음 셀 변경 가능일: 2026-03-28`

## 보안 / 악의적 변경 대응

주의할 점:

`1주일 제한`은 억제 장치이지, 강한 보안 장치는 아니다.

예를 들어 누군가 다른 셀 기도제목을 보기 위해 셀을 변경하면:

- 한 번은 바꿀 수 있음
- 대신 다시 원래 셀로 즉시 돌아오지 못함

즉, UX 차원에서는 제약이 되지만 접근 제어를 완전히 보장하진 않는다.

정말 강한 정책이 필요하면 아래 방식 중 하나를 추가 고려해야 한다.

- 관리자 승인 후 셀 변경
- 셀별 초대코드/가입코드 입력
- 관리자만 셀 변경 가능

현재 단계에서는 요구사항 기준으로 `1주일 쿨다운 + 변경 로그` 조합이 현실적이다.

## 게시판/게시글 접근 정책

### 목표

- 본인 셀 게시글만 조회 가능
- 게시글 작성 시 본인 셀에 귀속
- 다른 셀 게시글은 목록/상세 모두 차단

### 권장 규칙

#### 게시글 작성

- 작성 시 `session.user.id`로 사용자 조회
- 해당 사용자의 현재 `cell_id`를 가져옴
- `posts.cell_id = user.cell_id`로 저장

#### 게시글 목록 조회

- 로그인 사용자의 `cell_id`를 기준으로 `posts.cell_id = currentUser.cell_id`만 조회

#### 게시글 상세 조회

- 상세 조회 시도 시 해당 게시글의 `cell_id`와 현재 사용자 `cell_id` 비교
- 다르면 `404` 또는 `403` 처리

#### 댓글

- 댓글은 게시글에 종속되므로 별도 `cell_id`는 없어도 됨
- 단, 접근 가능한 게시글에만 댓글 조회/생성/수정/삭제 가능해야 함

## 현재 코드 기준 영향 범위

### DB

수정 대상:

- `supabase/schema.sql`

추가/변경 대상:

- `cell_groups`
- `cells`
- `user_cell_change_logs`
- `users.cell_id` 관련 컬럼
- `posts.cell_id`

### 인증

수정 대상:

- `client/src/features/auth/server.ts`
- `client/src/lib/auth/options.ts`

필요 작업:

- 회원가입 직후 셀 미설정 상태 허용
- 세션에 `cellId`를 같이 담을지 검토

### 게시글 서버 로직

수정 대상:

- `client/src/features/posts/server.ts`

필요 작업:

- 게시글 목록 조회 시 셀 조건 추가
- 게시글 상세 조회 시 셀 접근 검사 추가
- 게시글 생성 시 작성자 셀을 `posts.cell_id`에 저장

### UI / 페이지

수정 대상 후보:

- 신규 온보딩 페이지
- `client/src/pages/profile.tsx`
- 필요 시 홈 진입 가드

필요 작업:

- 그룹/셀 드롭다운 2단 구조
- 셀 미설정 유저 온보딩
- 마이페이지 셀 정보 수정 UI
- 셀 변경 가능 시점 안내 UI

## 추천 구현 순서

1. `cell_groups`, `cells`, `users`, `posts` 구조를 반영한 DB 스키마 초안 작성
2. 그룹/셀 seed 데이터 작성
3. 유저 셀 저장/변경 API 작성
4. 신규 가입 유저 온보딩 UI 작성
5. 기존 유저 마이페이지 셀 수정 UI 작성
6. 게시글 조회/작성 로직에 `cell_id` 필터 반영
7. 상세 조회/댓글 접근도 셀 기준으로 제한
8. 필요 시 관리자 승인 또는 초대코드 정책 검토

## 최종 권장안

현재 요구사항 기준 최종 권장안은 아래와 같다.

- 그룹과 셀은 별도 마스터 테이블로 관리한다.
- 유저는 현재 소속 셀을 `users.cell_id`로 가진다.
- 게시글은 작성 당시 셀을 `posts.cell_id`로 별도 저장한다.
- 셀 변경은 1주일에 1회만 가능하게 한다.
- 변경 이력은 로그 테이블로 남긴다.
- 게시글과 댓글은 본인 셀 범위 안에서만 조회 가능하게 한다.

## 보류 메모

아래 항목은 추가 정책 결정이 필요하다.

- 셀 변경에 관리자 승인까지 넣을지 여부
- 셀 미설정 유저에게 홈 접근을 막을지 여부
- 청장년부를 하나의 그룹으로 둘지, 별도 운영 단위로 더 세분화할지 여부
- 셀 리더 변경 시 `display_name`만 바꿀지, 과거 이력도 보존할지 여부
