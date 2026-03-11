# Ubique Prayer Board: Design & UI/UX Guideline

이 문서는 미니멀리즘과 청년부의 생동감을 결합한 UI/UX 설계안입니다.  
클라이언트 구현은 `shadcn/ui + Tailwind CSS`를 기준으로 진행합니다.

## 1) Visual Identity & Color Palette

청년부의 활기차고 깨끗한 느낌을 위해 `Ubique Blue`를 메인 컬러로 사용합니다.

| 구분 | 색상명 | Hex Code | 적용 위치 |
|---|---|---|---|
| Primary | Ubique Blue | `#3182F6` | 버튼, 상단 바, 강조 아이콘, 링크 |
| Point | Spirit Yellow | `#FFD43B` | 기도 응답 배지, 특별 공지, 리액션 |
| Success | Grace Green | `#2ECC71` | `기도 응답 완료` 상태 표시 |
| Background | Pure White | `#FFFFFF` | 앱 전체 배경 |
| Surface | Soft Gray | `#F2F4F7` | 카드 보더, 입력창 영역 배경 |
| Text Main | Dark Gray | `#191F28` | 제목 및 본문 |
| Text Sub | Slate Gray | `#8B95A1` | 날짜, 부가 설명, 플레이스홀더 |

## 2) UI/UX 핵심 원칙 (Toss Style)

- Extreme Rounding: 카드/버튼 `rounded-2xl` 이상(권장 18px)
- Clean Border: 그림자 최소화(`shadow-sm` 이하), 대신 `#F2F4F7` 1px 보더로 구분
- Typography: 기본 폰트 `Pretendard`, 넉넉한 행간으로 가독성 확보

## 3) 화면별 상세 설계

### 3.1 메인 피드 (Prayer Feed)

- 헤더: 좌측 상단 서비스명(`font-bold`), 우측 상단 프로필/알림 아이콘
- Pinned Card: 관리자 고정글은 `bg-[#3182F6]/10` 배너로 상단 노출
- Prayer Card:
  - 익명 작성은 작성자명을 `익명의 지체`로 표기
  - 토스 스타일의 부드러운 아바타 아이콘 사용
  - 하단에 댓글 수, `함께 기도해요` 리액션 버튼 배치

### 3.2 글쓰기 화면 (Post Creation)

- Full-screen Modal: 글쓰기 진입 시 전체 화면 모달
- Anonymity Switch: 체크박스 대신 `shadcn/ui Switch` 사용
  - 라벨 문구: `나를 숨기고 마음 전하기`
- Focus Mode: 제목 입력란 없이 본문 먼저 작성하는 메모장형 UI

### 3.3 프로필 및 히스토리

- Timeline: 내가 쓴 기도제목을 날짜 그룹으로 표시
- Status Toggle: 기도제목 카드에서 `응답 완료` 상태 토글 가능

## 4) Tailwind 설정 가이드

```js
// tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: "#3182F6",
      secondary: "#FFD43B",
      success: "#2ECC71",
      surface: "#F2F4F7",
      textMain: "#191F28",
      textSub: "#8B95A1",
    },
    borderRadius: {
      toss: "18px",
    },
  },
}
```

## 5) 개발 완료 전 체크리스트

- [ ] 버튼 클릭 시 `framer-motion` 미세 스케일 다운 효과 적용
- [ ] 입력창 포커스 시 보더가 `Ubique Blue`로 자연스럽게 전환
- [ ] 모바일 터치 요소(버튼/링크) 최소 터치 영역 확보
- [ ] PWA 세이프 에어리어(Safe Area) 패딩 적용
