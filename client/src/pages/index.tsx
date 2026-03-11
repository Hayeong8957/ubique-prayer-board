import { MessageCircle, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { LoginRequiredModal } from "@/components/auth/login-required-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  { code: "prayer", label: "기도제목" },
  { code: "sermon", label: "주일 말씀" },
];

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

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const [selectedBoard, setSelectedBoard] = useState<BoardCode>("prayer");
  const [feedByBoard, setFeedByBoard] = useState<Record<BoardCode, FeedState>>({
    prayer: createInitialFeedState(),
    sermon: createInitialFeedState(),
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
    } catch {
      setFeedByBoard((prev) => ({
        ...prev,
        [board]: {
          ...prev[board],
          error: "게시글을 불러오지 못했습니다.",
        },
      }));
    } finally {
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

  useEffect(() => {
    if (!feedByBoard[selectedBoard].loadedOnce && !feedByBoard[selectedBoard].isInitialLoading) {
      fetchPosts(selectedBoard, 1, false);
    }
  }, [feedByBoard, selectedBoard]);

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

  function onClickCreatePrayer() {
    if (!isPrayerBoard) return;
    if (status === "authenticated") {
      router.push("/prayers/new");
      return;
    }
    setIsLoginModalOpen(true);
  }

  async function onToggleAmen(postId: string) {
    if (status !== "authenticated") {
      setIsLoginModalOpen(true);
      return;
    }

    try {
      const response = await fetch(`/api/posts/${postId}/amen`, { method: "POST" });
      const payload = (await response.json()) as AmenToggleResponse;
      if (!response.ok || !payload.ok) return;

      setFeedByBoard((prev) => ({
        ...prev,
        [selectedBoard]: {
          ...prev[selectedBoard],
          posts: prev[selectedBoard].posts.map((post) =>
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
      // keep silent for MVP
    }
  }

  return (
    <div className="min-h-screen bg-background pb-3">
      <main className="mx-auto flex h-[calc(100dvh-0.75rem)] w-full max-w-2xl flex-col px-3 pt-3">
        <section className="shrink-0">
          <header className="mb-4 flex items-center justify-between px-1 pt-1">
            <h1 className="text-xl font-bold text-textMain">지용셀 중보기도</h1>
            {status === "authenticated" ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface bg-white text-textSub"
                  aria-label="프로필"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                >
                  <User className="h-5 w-5" />
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
                onClick={() => setSelectedBoard(tab.code)}
                className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                  selectedBoard === tab.code
                    ? "border border-primary bg-primary/10 text-primary"
                    : "border border-surface bg-white text-textSub hover:bg-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="px-1 pt-1">
            <Card className="mb-3 p-4">

              <p className="mb-1 text-sm font-semibold text-textMain">
                {isPrayerBoard ? "새 기도제목 작성" : "새 주일 말씀 작성"}
              </p>
              <p className="mb-3 text-sm text-textSub">
                {isPrayerBoard
                  ? "마음을 나누고 함께 기도받아 보세요."
                  : "주일 말씀 정리를 함께 나눠보세요."}
              </p>
              <button
                type="button"
                onClick={onClickCreatePrayer}
                disabled={!isPrayerBoard}
                className={`inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold transition ${
                  isPrayerBoard
                    ? "border border-primary bg-primary text-white hover:brightness-95"
                    : "cursor-not-allowed border border-surface bg-surface text-textSub"
                }`}
              >
                {isPrayerBoard ? "기도제목 작성하기" : "주일 말씀 작성 준비중"}
              </button>
            </Card>
          </div>
        </section>

        <section className="transparent-scroll flex-1 overflow-y-auto px-1 pt-1">
          {pinnedPost ? (
            <Card className="mb-3 bg-primary/10 p-4">
              <p className="text-sm font-semibold text-primary">
                📌 고정 {isPrayerBoard ? "기도제목" : "주일 말씀"}
              </p>
              <p className="mt-1 text-sm text-textMain">{pinnedPost.content}</p>
            </Card>
          ) : null}

          {error ? (
            <Card className="mb-3 border-red-100 bg-red-50 p-4 text-sm text-red-600">
              게시글을 불러오지 못했습니다: {error}
            </Card>
          ) : null}

          {!error && isInitialLoading ? (
            <Card className="mb-3 p-5 text-center text-sm text-textSub">
              {isPrayerBoard ? "기도제목" : "주일 말씀"}을 불러오는 중...
            </Card>
          ) : null}

          {normalPosts.map((post) => (
            <Card key={post.id} className="mb-3 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-textMain">{displayAuthor(post)}</p>
                <span className="text-xs text-textSub">{formatTimeLabel(post.createdAt)}</span>
              </div>
              {isPrayerBoard ? (
                <Link
                  href={`/prayers/${post.id}`}
                  className="mb-2 block text-sm font-semibold text-textMain"
                >
                  {post.title}
                </Link>
              ) : (
                <p className="mb-2 text-sm font-semibold text-textMain">{post.title}</p>
              )}
              <p className="mb-4 text-[15px] text-textMain">{post.content}</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={post.hasAmened ? "secondary" : "ghost"}
                  onClick={() => onToggleAmen(post.id)}
                >
                  🙏 아멘 {post.amenCount}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1">
                  <MessageCircle className="h-4 w-4" />
                  댓글 {post.commentCount}
                </Button>
              </div>
            </Card>
          ))}

          {!error && !isInitialLoading && normalPosts.length === 0 && !pinnedPost ? (
            <Card className="mb-3 p-5 text-center text-sm text-textSub">
              아직 등록된 {isPrayerBoard ? "기도제목" : "주일 말씀"}이 없습니다.
            </Card>
          ) : null}

          <div ref={loadMoreRef} className="h-6" />
          {isLoadingMore ? (
            <p className="mb-3 text-center text-sm text-textSub">더 불러오는 중...</p>
          ) : null}
          {!hasNextPage && posts.length > 0 ? (
            <p className="mb-3 text-center text-xs text-textSub">마지막 기도제목까지 확인했어요.</p>
          ) : null}
        </section>
      </main>

      <LoginRequiredModal
        open={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
}
