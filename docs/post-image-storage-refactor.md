# Post Image Storage Refactor

## 목표

- Storage 경로를 `post-images/posts/<postId>/<uuid>.<ext>`로 고정한다.
- 이미지 업로드는 게시글 초안 생성 이후에만 수행한다.
- 이미지 메타데이터는 `post_images` 테이블로 분리한다.
- 기존 `posts.image_urls`는 목록 조회 호환성과 점진적 이전을 위한 캐시 컬럼으로 유지한다.

## 현재 구조의 문제

- 사용자 기준 경로(`userId/yyyy/mm/...`)는 어떤 게시글 이미지인지 즉시 식별하기 어렵다.
- 수동 업로드 파일과 앱 업로드 파일이 섞여 보인다.
- 게시글 삭제/수정 시 이미지 정리 기준이 `postId`가 아니라 운영이 불편하다.
- `posts.image_urls` 배열만으로는 정렬, 삭제, 후속 확장이 제한된다.

## 목표 구조

### Storage

- 버킷: `post-images`
- 경로: `posts/<postId>/<uuid>.<ext>`

예시:

- `post-images/posts/3fd3d9a4-.../1f7a2a6e-....png`

### Database

`posts`

- `status`: `draft | published`
- `published_at`
- `image_urls`: 기존 호환용 public URL 캐시

`post_images`

- `id`
- `post_id`
- `object_path`
- `public_url`
- `sort_order`
- `created_at`

## 게시글 작성 플로우

1. 사용자가 작성 화면에 진입한다.
2. 제출 직전, 서버에서 게시글 초안을 먼저 생성한다.
3. 초안 `postId`를 기준으로 이미지를 `post-images/posts/<postId>/...`에 업로드한다.
4. 업로드 성공 시 `post_images`에 메타데이터를 저장한다.
5. 마지막에 게시글 본문 저장 API가 호출되면서 `draft -> published`로 전환된다.

## UI / 사용자 프로세스 영향

- 의도한 사용자 경험 변화는 없다.
- 사용자는 기존처럼:
  - 본문 입력
  - 이미지 선택
  - 등록 버튼 클릭
  순서로 사용한다.
- 내부적으로만 `초안 생성 -> 이미지 업로드 -> 최종 게시` 순서로 바뀐다.

주의:

- 사용자가 작성 중 이탈하면 DB에 draft와 미사용 이미지가 남을 수 있다.
- 장기적으로는 draft 정리 배치나 만료 정책이 필요하다.

## 수정 플로우

- 기존 게시글 수정 시 새 이미지는 같은 `postId` 경로 아래 추가 업로드한다.
- 사용자가 제거한 이미지는 `post_images`에서 제거한다.
- `object_path`가 있는 경우 Storage 삭제도 함께 시도한다.

## 마이그레이션 방향

1. `posts.status`, `posts.published_at` 추가
2. `post_images` 테이블 생성
3. 기존 `posts.image_urls` 데이터를 `post_images`로 백필
4. 앱 코드에서 `post_images` 기준으로 읽고, `posts.image_urls`는 동기화 캐시로 사용

## 리스크

- draft 생성 후 게시 완료 전 이탈 시 orphan 데이터가 생길 수 있다.
- 기존 이미지 URL만 있던 데이터는 `object_path`를 알 수 없어 Storage 정리가 제한될 수 있다.
- 이를 위해 `post_images.object_path`는 nullable로 두고 점진적으로 정리한다.
