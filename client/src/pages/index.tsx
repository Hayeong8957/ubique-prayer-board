import { MessageCircle, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LoginRequiredModal } from "@/components/auth/LoginRequiredModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";
import type { BoardCode, PostListItem } from "@/features/posts/types";

type PostListResponse =
  | {
      ok: true;
      data: PostListItem[];
      pagination: { page: number; pageSize: number; hasMore: boolean; nextPage: number | null };
    }
  | { ok: false; error: string };

type AmenToggleResponse =
  | { ok: true; data: { amenCount: number; hasAmened: boolean } }
  | { ok: false; error: string };

interface FeedState {
  posts: PostListItem[];
  error: string | null;
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  nextPage: number | null;
  loadedOnce: boolean;
}

const BOARD_TABS: Array<{ code: BoardCode; label: string }> = [
  { code: "prayer", label: "🙏기도제목🙏" },
  { code: "horeb", label: "✨호렙산 기도회✨" },
  { code: "sermon", label: "주일 말씀" },
];

function parseBoardFromQuery(value: string | string[] | undefined): BoardCode {
  if (value === "sermon") return "sermon";
  if (value === "horeb") return "horeb";
  return "prayer";
}

function createInitialFeedState(): FeedState {
  return {
    posts: [],
    error: null,
    isInitialLoading: false,
    isLoadingMore: false,
    nextPage: 1,
    loadedOnce: false,
  };
}

function formatTimeLabel(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function displayAuthor(post: PostListItem) {
  return post.isAnonymous ? "익명의 지체" : post.authorName;
}

function getDetailPath(boardCode: BoardCode, postId: string) {
  if (boardCode === "prayer") return `/prayers/${postId}`;
  if (boardCode === "horeb") return `/horeb/${postId}`;
  return `/sermons/${postId}`;
}

function getCommentsPath(boardCode: BoardCode, postId: string) {
  return `${getDetailPath(boardCode, postId)}#comments`;
}

function getBoardDisplay(boardCode: BoardCode) {
  switch (boardCode) {
    case "prayer":
      return {
        createTitle: "새 기도제목 작성",
        createDescription: "마음을 나누고 함께 기도받아 보세요.",
        createButton: "기도제목 작성하기",
        pinnedLabel: "기도제목",
        loadingLabel: "기도제목",
        emptyLabel: "기도제목",
        endLabel: "기도제목",
      };
    case "horeb":
      return {
        createTitle: "새 호렙산 기도회 말씀 작성",
        createDescription: "호렙산 기도회 말씀 정리를 함께 나눠보세요.",
        createButton: "호렙산 기도회 말씀 작성하기",
        pinnedLabel: "호렙산 기도회 말씀",
        loadingLabel: "호렙산 기도회 말씀",
        emptyLabel: "호렙산 기도회 말씀",
        endLabel: "호렙산 기도회 말씀",
      };
    default:
      return {
        createTitle: "새 주일 말씀 작성",
        createDescription: "주일 말씀 정리를 함께 나눠보세요.",
        createButton: "주일 말씀 작성하기",
        pinnedLabel: "주일 말씀",
        loadingLabel: "주일 말씀",
        emptyLabel: "주일 말씀",
        endLabel: "주일 말씀",
      };
  }
}

export default function Home() {
  const router = useRouter();
  const { status, data: session } = useSession();
  const [selectedBoard, setSelectedBoard] = useState<BoardCode>(() =>
    parseBoardFromQuery(router.query.board)
  );
  const [feedByBoard, setFeedByBoard] = useState<Record<BoardCode, FeedState>>({
    prayer: createInitialFeedState(),
    sermon: createInitialFeedState(),
    horeb: createInitialFeedState(),
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [amenPendingByPostId, setAmenPendingByPostId] = useState<Record<string, boolean>>({});

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const feedScrollRef = useRef<HTMLElement | null>(null);
  const inFlightRequestKeysRef = useRef<Set<string>>(new Set());
  const loadedPagesRef = useRef<Record<BoardCode, Set<number>>>({
    prayer: new Set<number>(),
    sermon: new Set<number>(),
    horeb: new Set<number>(),
  });

  const currentFeed = feedByBoard[selectedBoard];
  const posts = currentFeed.posts;
  const error = currentFeed.error;
  const isInitialLoading = currentFeed.isInitialLoading;
  const isLoadingMore = currentFeed.isLoadingMore;
  const nextPage = currentFeed.nextPage;
  const hasNextPage = nextPage !== null;

  const pinnedPost = posts.find((post) => post.isPinned);
  const normalPosts = posts.filter((post) => !post.isPinned);
  const isPrayerBoard = selectedBoard === "prayer";
  const boardDisplay = getBoardDisplay(selectedBoard);

  useEffect(() => {
    if (!router.isReady) return;
    const boardFromQuery = parseBoardFromQuery(router.query.board);
    setSelectedBoard(boardFromQuery);
  }, [router.isReady, router.query.board]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!profileMenuRef.current) return;
      const target = event.target as Node;
      if (!profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
    }

    if (isProfileMenuOpen) {
      window.addEventListener("mousedown", onClickOutside);
    }

    return () => {
      window.removeEventListener("mousedown", onClickOutside);
    };
  }, [isProfileMenuOpen]);

  async function fetchPosts(board: BoardCode, page: number, append: boolean) {
    const requestKey = `${board}:${page}`;
    if (inFlightRequestKeysRef.current.has(requestKey)) return;
    if (loadedPagesRef.current[board].has(page)) return;

    inFlightRequestKeysRef.current.add(requestKey);

    setFeedByBoard((prev) => ({
      ...prev,
      [board]: {
        ...prev[board],
        isInitialLoading: append ? prev[board].isInitialLoading : true,
        isLoadingMore: append ? true : prev[board].isLoadingMore,
      },
    }));

    try {
      const response = await fetch(`/api/posts?boardType=${board}&page=${page}&pageSize=10`);
      const payload = (await response.json()) as PostListResponse;

      if (!response.ok || !payload.ok) {
        const message = payload.ok ? "게시글 조회 실패" : payload.error;
        setFeedByBoard((prev) => ({
          ...prev,
          [board]: {
            ...prev[board],
            error: message,
          },
        }));
        return;
      }

      setFeedByBoard((prev) => ({
        ...prev,
        [board]: {
          ...prev[board],
          error: null,
          loadedOnce: true,
          nextPage: payload.pagination.nextPage,
          posts: append ? [...prev[board].posts, ...payload.data] : payload.data,
        },
      }));
      loadedPagesRef.current[board].add(page);
    } catch {
      setFeedByBoard((prev) => ({
        ...prev,
        [board]: {
          ...prev[board],
          error: "게시글을 불러오지 못했습니다.",
        },
      }));
    } finally {
      inFlightRequestKeysRef.current.delete(requestKey);
      setFeedByBoard((prev) => ({
        ...prev,
        [board]: {
          ...prev[board],
          isInitialLoading: false,
          isLoadingMore: false,
        },
      }));
    }
  }

  const selectedFeed = feedByBoard[selectedBoard];

  useEffect(() => {
    if (!selectedFeed.loadedOnce && !selectedFeed.isInitialLoading) {
      fetchPosts(selectedBoard, 1, false);
    }
  }, [selectedBoard, selectedFeed.loadedOnce, selectedFeed.isInitialLoading]);

  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first.isIntersecting || isInitialLoading || isLoadingMore) return;
        if (nextPage === null) return;
        fetchPosts(selectedBoard, nextPage, true);
      },
      { rootMargin: "160px" }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isInitialLoading, isLoadingMore, nextPage, selectedBoard]);

  useEffect(() => {
    if (posts.length === 0) return;
    const prefetchTargets = posts.slice(0, 5);
    for (const post of prefetchTargets) {
      const path = getDetailPath(selectedBoard, post.id);
      router.prefetch(path).catch(() => {
        // ignore prefetch failures
      });
    }
  }, [posts, router, selectedBoard]);

  function onClickCreatePrayer() {
      if (status === "authenticated") {
      if (selectedBoard === "prayer") {
        router.push("/prayers/new");
        return;
      }
      if (selectedBoard === "horeb") {
        router.push("/horeb/new");
        return;
      }
      router.push("/sermons/new");
      return;
    }
    setIsLoginModalOpen(true);
  }

  async function onToggleAmen(postId: string) {
    if (status !== "authenticated") {
      setIsLoginModalOpen(true);
      return;
    }
    if (amenPendingByPostId[postId]) return;

    const boardAtRequest = selectedBoard;
    const targetPost = feedByBoard[boardAtRequest].posts.find((post) => post.id === postId);
    if (!targetPost) return;

    const previousAmenCount = targetPost.amenCount;
    const previousHasAmened = targetPost.hasAmened;
    const optimisticHasAmened = !previousHasAmened;
    const optimisticAmenCount = optimisticHasAmened
      ? previousAmenCount + 1
      : Math.max(previousAmenCount - 1, 0);

    setAmenPendingByPostId((prev) => ({ ...prev, [postId]: true }));
    setFeedByBoard((prev) => ({
      ...prev,
      [boardAtRequest]: {
        ...prev[boardAtRequest],
        posts: prev[boardAtRequest].posts.map((post) =>
          post.id === postId
            ? {
                ...post,
                amenCount: optimisticAmenCount,
                hasAmened: optimisticHasAmened,
              }
            : post
        ),
      },
    }));

    try {
      const response = await fetch(`/api/posts/${postId}/amen`, { method: "POST" });
      const payload = (await response.json()) as AmenToggleResponse;
      if (!response.ok || !payload.ok) {
        setFeedByBoard((prev) => ({
          ...prev,
          [boardAtRequest]: {
            ...prev[boardAtRequest],
            posts: prev[boardAtRequest].posts.map((post) =>
              post.id === postId
                ? {
                    ...post,
                    amenCount: previousAmenCount,
                    hasAmened: previousHasAmened,
                  }
                : post
            ),
          },
        }));
        return;
      }

      setFeedByBoard((prev) => ({
        ...prev,
        [boardAtRequest]: {
          ...prev[boardAtRequest],
          posts: prev[boardAtRequest].posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  amenCount: payload.data.amenCount,
                  hasAmened: payload.data.hasAmened,
                }
              : post
          ),
        },
      }));
    } catch {
      setFeedByBoard((prev) => ({
        ...prev,
        [boardAtRequest]: {
          ...prev[boardAtRequest],
          posts: prev[boardAtRequest].posts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  amenCount: previousAmenCount,
                  hasAmened: previousHasAmened,
                }
              : post
          ),
        },
      }));
    } finally {
      setAmenPendingByPostId((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    }
  }

  return (
    <div className="min-h-screen bg-background pb-3">
      <main className="mx-auto flex h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col px-3 pt-3">
        <section className="shrink-0">
          <header className="mb-4 flex items-center justify-between px-1 pt-1">
            <div className="flex items-center gap-2">
              <Image
                src="/icon.png"
                alt="Ubique 로고"
                width={38}
                height={38}
                className="rounded-xl object-cover"
              />
              <h1 className="text-xl font-bold text-textMain">지용셀의 작은 기도 공간</h1>
            </div>
            {status === "authenticated" ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  className="flex h-[40px] w-[40px] items-center justify-center overflow-hidden rounded-full border border-surface bg-white text-textSub"
                  aria-label="프로필"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                >
                  {session?.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt="프로필 이미지"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </button>

                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-12 z-20 min-w-36 overflow-hidden rounded-xl border border-surface bg-white shadow-sm">
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-textMain hover:bg-surface"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        router.push("/profile");
                      }}
                    >
                      내 프로필
                    </button>
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-textMain hover:bg-surface"
                      onClick={() => signOut({ callbackUrl: "/" })}
                    >
                      로그아웃
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-10 rounded-xl px-5 text-base font-semibold text-textMain"
                onClick={() => signIn("kakao", { callbackUrl: "/" })}
              >
                로그인
              </Button>
            )}
          </header>
          <div className="mb-3 flex items-center gap-2 px-1 pt-1">
            {BOARD_TABS.map((tab) => (
              <button
                key={tab.code}
                type="button"
                onClick={() => {
                  setSelectedBoard(tab.code);
                  router.replace(
                    {
                      pathname: "/",
                      query: { board: tab.code },
                    },
                    undefined,
                    { shallow: true, scroll: false }
                  );
                }}
                className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                  selectedBoard === tab.code
                    ? "border border-primary bg-primary/10 text-primary"
                    : "border border-gray-300 bg-white text-textSub hover:bg-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="px-1 pt-1">
            <Card className="mb-3 p-4">

              <p className="mb-1 text-sm font-semibold text-textMain">
                {boardDisplay.createTitle}
              </p>
              <p className="mb-3 text-sm text-textSub">
                {boardDisplay.createDescription}
              </p>
              <button
                type="button"
                onClick={onClickCreatePrayer}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-primary bg-primary px-5 text-sm font-semibold text-white transition hover:brightness-95"
              >
                {boardDisplay.createButton}
              </button>
            </Card>
          </div>
        </section>

        <section ref={feedScrollRef} className="transparent-scroll flex-1 overflow-y-auto px-1 pt-1">
          {pinnedPost ? (
            <Card className="mb-3 bg-primary/10 p-4">
              <p className="text-sm font-semibold text-primary">
                📌 고정 {boardDisplay.pinnedLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-textMain">{pinnedPost.title}</p>
              {!isPrayerBoard && pinnedPost.scriptureText ? (
                <p className="mt-1 text-sm text-textSub">{pinnedPost.scriptureText}</p>
              ) : null}
              {isPrayerBoard ? (
                <p className="mt-1 text-sm text-textMain">{pinnedPost.content}</p>
              ) : null}
            </Card>
          ) : null}

          {error ? (
            <Card className="mb-3 border-red-100 bg-red-50 p-4 text-sm text-red-600">
              게시글을 불러오지 못했습니다: {error}
            </Card>
          ) : null}

          {!error && isInitialLoading ? (
            <Card className="mb-3 p-5 text-center text-sm text-textSub">
              {boardDisplay.loadingLabel}을 불러오는 중...
            </Card>
          ) : null}

          {normalPosts.map((post) => (
            <Card
              key={post.id}
              className="mb-3 cursor-pointer p-4"
              role="button"
              tabIndex={0}
              onClick={() => {
                router.push(getDetailPath(selectedBoard, post.id));
              }}
              onMouseEnter={() => {
                router.prefetch(getDetailPath(selectedBoard, post.id)).catch(() => {
                  // ignore prefetch failures
                });
              }}
              onTouchStart={() => {
                router.prefetch(getDetailPath(selectedBoard, post.id)).catch(() => {
                  // ignore prefetch failures
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(getDetailPath(selectedBoard, post.id));
                }
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-textMain">{displayAuthor(post)}</p>
                <span className="text-xs text-textSub">{formatTimeLabel(post.createdAt)}</span>
              </div>
              {isPrayerBoard ? (
                <p className="mb-2 text-sm font-semibold text-textMain">{post.title}</p>
              ) : (
                <>
                  <p className="mb-2 text-sm font-semibold text-textMain">{post.title}</p>
                  {post.scriptureText ? (
                    <p className="mb-3 text-sm text-textSub">{post.scriptureText}</p>
                  ) : null}
                </>
              )}
              {isPrayerBoard ? (
                <p className="mb-4 whitespace-pre-wrap text-[15px] text-textMain">{post.content}</p>
              ) : null}
              <div className="grid w-1/2 min-w-[220px] max-w-[260px] grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={post.hasAmened ? "secondary" : "ghost"}
                  className="w-full justify-center"
                  disabled={Boolean(amenPendingByPostId[post.id])}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleAmen(post.id);
                  }}
                >
                  🙏 아멘 {post.amenCount}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-center gap-1"
                  onClick={(event) => {
                    event.stopPropagation();
                    router.push(getCommentsPath(selectedBoard, post.id));
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  댓글 {post.commentCount}
                </Button>
              </div>
            </Card>
          ))}

          {!error && !isInitialLoading && normalPosts.length === 0 && !pinnedPost ? (
            <Card className="mb-3 p-5 text-center text-sm text-textSub">
              아직 등록된 {boardDisplay.emptyLabel}이 없습니다.
            </Card>
          ) : null}

          <div ref={loadMoreRef} className="h-6" />
          {isLoadingMore ? (
            <p className="mb-3 text-center text-sm text-textSub">더 불러오는 중...</p>
          ) : null}
          {!hasNextPage && posts.length > 0 ? (
            <p className="mb-3 text-center text-xs text-textSub">
              마지막 {boardDisplay.endLabel}까지 확인했어요.
            </p>
          ) : null}
        </section>
      </main>

      <LoginRequiredModal
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
      <ScrollToTopButton containerRef={feedScrollRef} />
    </div>
  );
}
