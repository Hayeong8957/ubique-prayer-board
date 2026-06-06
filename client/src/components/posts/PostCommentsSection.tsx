import { MessageCircle, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CommentItem, CommentPagination } from "@/features/posts/types";

type CommentsResponse =
  | { ok: true; data: CommentItem[]; pagination: CommentPagination }
  | { ok: false; error: string };

interface PostCommentsSectionProps {
  postId: string;
  currentUserId: string | null;
  initialCommentCount: number;
}

function formatCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function displayAuthor(comment: CommentItem) {
  return comment.isAnonymous ? "익명의 지체" : comment.authorName;
}

function mergeUniqueComments(nextComments: CommentItem[], currentComments: CommentItem[]) {
  const seen = new Set(currentComments.map((comment) => comment.id));
  return nextComments.filter((comment) => !seen.has(comment.id));
}

export function PostCommentsSection({
  postId,
  currentUserId,
  initialCommentCount,
}: PostCommentsSectionProps) {
  const router = useRouter();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingScrollHeightRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadInitialComments() {
      setIsInitialLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/posts/${postId}/comments?page=1&pageSize=5`);
        const payload = (await response.json()) as CommentsResponse;
        if (!response.ok || !payload.ok) {
          setLoadError(payload.ok ? "댓글을 불러오지 못했습니다." : payload.error);
          return;
        }

        setComments(payload.data);
        setHasMore(payload.pagination.hasMore);
        setNextPage(payload.pagination.nextPage);
      } catch {
        setLoadError("댓글을 불러오지 못했습니다.");
      } finally {
        setIsInitialLoading(false);
      }
    }

    loadInitialComments().catch(() => {
      setLoadError("댓글을 불러오지 못했습니다.");
      setIsInitialLoading(false);
    });
  }, [postId]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const syncKeyboardOffset = () => {
      const nextOffset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop
      );
      setKeyboardOffset(nextOffset);
    };

    syncKeyboardOffset();
    viewport.addEventListener("resize", syncKeyboardOffset);
    viewport.addEventListener("scroll", syncKeyboardOffset);
    return () => {
      viewport.removeEventListener("resize", syncKeyboardOffset);
      viewport.removeEventListener("scroll", syncKeyboardOffset);
    };
  }, []);

  useEffect(() => {
    if (!loadMoreTriggerRef.current || !hasMore || nextPage === null) return;

    const target = loadMoreTriggerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isInitialLoading || isLoadingMore) return;

        const pageToLoad = nextPage;
        if (pageToLoad === null) return;

        pendingScrollHeightRef.current = document.documentElement.scrollHeight;
        setIsLoadingMore(true);
        fetch(`/api/posts/${postId}/comments?page=${pageToLoad}&pageSize=5`)
          .then(async (response) => {
            const payload = (await response.json()) as CommentsResponse;
            if (!response.ok || !payload.ok) {
              throw new Error(payload.ok ? "댓글을 더 불러오지 못했습니다." : payload.error);
            }

            setComments((prev) => {
              const prepended = mergeUniqueComments(payload.data, prev);
              return [...prepended, ...prev];
            });
            setHasMore(payload.pagination.hasMore);
            setNextPage(payload.pagination.nextPage);
          })
          .catch((error) => {
            pendingScrollHeightRef.current = null;
            setLoadError(error instanceof Error ? error.message : "댓글을 더 불러오지 못했습니다.");
          })
          .finally(() => {
            setIsLoadingMore(false);
          });
      },
      { rootMargin: "180px 0px 0px 0px" }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isInitialLoading, isLoadingMore, nextPage, postId]);

  useEffect(() => {
    if (pendingScrollHeightRef.current === null) return;

    const previousHeight = pendingScrollHeightRef.current;
    pendingScrollHeightRef.current = null;

    requestAnimationFrame(() => {
      const nextHeight = document.documentElement.scrollHeight;
      const delta = nextHeight - previousHeight;
      if (delta > 0) {
        window.scrollBy({ top: delta });
      }
    });
  }, [comments]);

  useEffect(() => {
    const element = composerTextareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }, [composerValue]);

  useEffect(() => {
    const element = editingTextareaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`;
  }, [editingValue, editingCommentId]);

  async function onSubmitComment() {
    if (!currentUserId) {
      await router.push(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
      return;
    }

    if (!composerValue.trim()) {
      setComposerError("댓글 내용을 입력해주세요.");
      return;
    }

    setComposerError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: composerValue }),
      });
      const payload = (await response.json()) as CommentsResponse;
      if (!response.ok || !payload.ok) {
        setComposerError(payload.ok ? "댓글 작성 중 오류가 발생했습니다." : payload.error);
        return;
      }

      const createdComment = payload.data[0];
      if (!createdComment) {
        setComposerError("댓글 작성 결과를 확인할 수 없습니다.");
        return;
      }

      setComments((prev) => (prev.some((comment) => comment.id === createdComment.id)
        ? prev
        : [...prev, createdComment]));
      setCommentCount((prev) => prev + 1);
      setComposerValue("");

      requestAnimationFrame(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      });
    } catch {
      setComposerError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSaveComment(commentId: string) {
    if (!editingValue.trim()) {
      setComposerError("댓글 내용을 입력해주세요.");
      return;
    }

    setComposerError(null);
    setPendingCommentId(commentId);
    try {
      const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editingValue }),
      });
      const payload = (await response.json()) as CommentsResponse;
      if (!response.ok || !payload.ok) {
        setComposerError(payload.ok ? "댓글 수정 중 오류가 발생했습니다." : payload.error);
        return;
      }

      const updatedComment = payload.data[0];
      if (!updatedComment) {
        setComposerError("댓글 수정 결과를 확인할 수 없습니다.");
        return;
      }

      setComments((prev) =>
        prev.map((comment) => (comment.id === commentId ? updatedComment : comment))
      );
      setEditingCommentId(null);
      setEditingValue("");
    } catch {
      setComposerError("네트워크 오류가 발생했습니다.");
    } finally {
      setPendingCommentId(null);
    }
  }

  async function onDeleteComment(commentId: string) {
    const ok = window.confirm("이 댓글을 삭제할까요?");
    if (!ok) return;

    setComposerError(null);
    setPendingCommentId(commentId);
    try {
      const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as CommentsResponse;
      if (!response.ok || !payload.ok) {
        setComposerError(payload.ok ? "댓글 삭제 중 오류가 발생했습니다." : payload.error);
        return;
      }

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      setCommentCount((prev) => Math.max(prev - 1, 0));
      if (editingCommentId === commentId) {
        setEditingCommentId(null);
        setEditingValue("");
      }
    } catch {
      setComposerError("네트워크 오류가 발생했습니다.");
    } finally {
      setPendingCommentId(null);
    }
  }

  function startEditing(comment: CommentItem) {
    setEditingCommentId(comment.id);
    setEditingValue(comment.content);
    setComposerError(null);
  }

  return (
    <>
      <Card id="comments" className="mt-3 scroll-mt-24 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-textMain">댓글 {commentCount}</h2>
          </div>
          {isLoadingMore ? <span className="text-xs text-textSub">이전 댓글 불러오는 중...</span> : null}
        </div>

        <div ref={loadMoreTriggerRef} className="h-1 w-full" />

        {loadError ? (
          <p className="mb-3 text-sm text-red-600">{loadError}</p>
        ) : null}

        {isInitialLoading ? (
          <p className="py-6 text-center text-sm text-textSub">댓글을 불러오는 중...</p>
        ) : comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-textSub">첫 댓글을 남겨보세요.</p>
        ) : (
          <div className="space-y-3">
            {hasMore ? (
              <p className="text-center text-xs text-textSub">위로 스크롤하면 이전 댓글을 더 불러옵니다.</p>
            ) : null}

            {comments.map((comment) => {
              const isMine = Boolean(currentUserId && comment.authorUserId === currentUserId);
              const isEditing = editingCommentId === comment.id;
              const isPending = pendingCommentId === comment.id;

              return (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-surface bg-surface/40 px-4 py-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-textMain">{displayAuthor(comment)}</p>
                      <p className="text-xs text-textSub">{formatCommentDate(comment.createdAt)}</p>
                    </div>
                    {isMine ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-textSub transition hover:bg-white hover:text-textMain"
                          onClick={() => startEditing(comment)}
                          disabled={isPending}
                          aria-label="댓글 수정"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-textSub transition hover:bg-white hover:text-[var(--ubique-fail)]"
                          onClick={() => onDeleteComment(comment.id)}
                          disabled={isPending}
                          aria-label="댓글 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        ref={editingTextareaRef}
                        value={editingValue}
                        onChange={(event) => setEditingValue(event.target.value)}
                        className="min-h-[96px] w-full resize-none rounded-2xl border border-surface bg-white px-4 py-3 text-sm text-textMain outline-none"
                        placeholder="댓글을 수정해주세요."
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingValue("");
                            setComposerError(null);
                          }}
                          disabled={isPending}
                        >
                          취소
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onSaveComment(comment.id)}
                          disabled={isPending}
                        >
                          {isPending ? "저장 중..." : "저장"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-textMain">
                      {comment.content}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="h-32" aria-hidden />

      <div
        className="fixed inset-x-0 z-40"
        style={{ bottom: keyboardOffset }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 pb-[calc(var(--ubique-safe-bottom)+14px)]">
          <div className="rounded-[22px] border border-surface bg-white/95 p-2 shadow-[0_-10px_35px_rgba(25,31,40,0.08)] backdrop-blur">
            {composerError ? (
              <p className="mb-2 px-1 text-sm text-red-600">{composerError}</p>
            ) : null}

            <div className="flex items-stretch gap-2.5">
              <textarea
                ref={composerTextareaRef}
                value={composerValue}
                onChange={(event) => setComposerValue(event.target.value)}
                onFocus={() => {
                  requestAnimationFrame(() => {
                    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
                  });
                }}
                placeholder={
                  currentUserId ? "댓글을 입력해주세요." : "로그인 후 댓글을 입력할 수 있습니다."
                }
                className="h-[48px] min-h-[48px] flex-1 resize-none rounded-2xl bg-surface px-4 py-3 text-sm leading-5 text-textMain outline-none placeholder:text-textSub"
              />
              <Button
                size="sm"
                className="h-[48px] min-w-[84px] rounded-2xl"
                onClick={onSubmitComment}
                disabled={isSubmitting}
              >
                {currentUserId ? (isSubmitting ? "등록 중..." : "게시") : "로그인"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
