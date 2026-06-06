import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { PostCommentsSection } from "@/components/posts/PostCommentsSection";
import { PostImageGallery } from "@/components/posts/PostImageGallery";
import { PostImagePicker } from "@/components/posts/PostImagePicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ScrollToTopButton } from "@/components/ui/ScrollToTopButton";
import {
  createLocalPostImageDraft,
  deletePostImage,
  POST_IMAGE_MAX_COUNT,
  revokeLocalPostImageDraft,
  uploadPostImage,
  validatePostImageFile,
  type LocalPostImageDraft,
  type UploadedPostImage,
} from "@/features/posts/images.client";
import { getPostById } from "@/features/posts/server";
import type { PostDetail } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

interface PrayerDetailPageProps {
  post: PostDetail | null;
  canManage: boolean;
  currentUserId: string | null;
  error?: string;
}

function displayAuthor(name: string, isAnonymous: boolean) {
  return isAnonymous ? "익명의 지체" : name;
}

function formatFullDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

type UpdatePostResponse = { ok: true; data: { id: string } } | { ok: false; error: string };

export default function PrayerDetailPage({
  post,
  canManage,
  currentUserId,
  error,
}: PrayerDetailPageProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(post?.content ?? "");
  const [isAnonymous, setIsAnonymous] = useState(post?.isAnonymous ?? false);
  const [uploadedImages, setUploadedImages] = useState<UploadedPostImage[]>(
    (post?.images ?? []).map((image) => ({
      id: image.id,
      publicUrl: image.publicUrl,
      sortOrder: image.sortOrder,
    }))
  );
  const [localImages, setLocalImages] = useState<LocalPostImageDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const localImagesRef = useRef<LocalPostImageDraft[]>([]);
  const initialUploadedImageIdsRef = useRef(new Set((post?.images ?? []).map((image) => image.id)));
  const uploadControllersRef = useRef<Record<string, AbortController>>({});

  useEffect(() => {
    localImagesRef.current = localImages;
  }, [localImages]);

  useEffect(() => {
    return () => {
      Object.values(uploadControllersRef.current).forEach((controller) => controller.abort());
      for (const image of localImagesRef.current) {
        revokeLocalPostImageDraft(image);
      }
    };
  }, []);

  const isUploadingImages = localImages.some((image) => image.status === "uploading");

  async function onAddFiles(files: File[]) {
    const nextDrafts: LocalPostImageDraft[] = [];
    const totalCount = uploadedImages.length + localImages.length;

    for (const file of files) {
      if (totalCount + nextDrafts.length >= POST_IMAGE_MAX_COUNT) {
        setSubmitError(`이미지는 최대 ${POST_IMAGE_MAX_COUNT}장까지 첨부할 수 있습니다.`);
        break;
      }

      const validationError = validatePostImageFile(file);
      if (validationError) {
        setSubmitError(validationError);
        continue;
      }

      nextDrafts.push(createLocalPostImageDraft(file));
    }

    if (nextDrafts.length > 0) {
      setSubmitError(null);
      setLocalImages((prev) => [...prev, ...nextDrafts]);
      nextDrafts.forEach((draft) => {
        const controller = new AbortController();
        uploadControllersRef.current[draft.id] = controller;

        void uploadPostImage(postId, draft.file, controller.signal)
          .then((uploaded) => {
            setUploadedImages((prev) => [...prev, uploaded]);
            setLocalImages((prev) => prev.filter((image) => image.id !== draft.id));
            revokeLocalPostImageDraft(draft);
          })
          .catch((e) => {
            if (e instanceof DOMException && e.name === "AbortError") {
              return;
            }
            if (e instanceof Error && e.message === "This operation was aborted") {
              return;
            }
            setSubmitError(e instanceof Error ? e.message : "이미지 업로드 중 오류가 발생했습니다.");
            setLocalImages((prev) =>
              prev.map((image) =>
                image.id === draft.id ? { ...image, status: "failed" } : image
              )
            );
          })
          .finally(() => {
            delete uploadControllersRef.current[draft.id];
          });
      });
    }
  }

  function onRemoveLocalImage(id: string) {
    const controller = uploadControllersRef.current[id];
    if (controller) {
      controller.abort();
      delete uploadControllersRef.current[id];
    }
    setLocalImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) revokeLocalPostImageDraft(target);
      return prev.filter((image) => image.id !== id);
    });
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Card className="border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</Card>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Card className="p-5 text-sm text-textSub">게시글을 찾을 수 없습니다.</Card>
      </main>
    );
  }
  const postId = post.id;

  async function onSave() {
    if (!content.trim()) {
      setSubmitError("본문을 입력해주세요.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          imageIds: uploadedImages.map((image) => image.id),
          isAnonymous,
        }),
      });
      const payload = (await response.json()) as UpdatePostResponse;
      if (!response.ok || !payload.ok) {
        setSubmitError(payload.ok ? "수정 중 오류가 발생했습니다." : payload.error);
        return;
      }
      setIsEditing(false);
      await router.replace(router.asPath);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    const ok = window.confirm("이 기도제목을 삭제할까요?");
    if (!ok) return;

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      const payload = (await response.json()) as UpdatePostResponse;
      if (!response.ok || !payload.ok) {
        setSubmitError(payload.ok ? "삭제 중 오류가 발생했습니다." : payload.error);
        return;
      }
      await router.push("/?board=prayer");
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      <div className="sticky top-0 z-30 border-b border-surface/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center px-4 py-4">
          <Link href="/?board=prayer" className="text-sm font-medium text-primary">
            ← 기도제목 목록으로
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl px-4 pt-4">

        <Card className="mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-textMain">
              {displayAuthor(post.authorName, isEditing ? isAnonymous : post.isAnonymous)}
            </p>
            <span className="text-xs text-textSub">{formatFullDate(post.createdAt)}</span>
          </div>
          <h1 className="mb-2 text-lg font-bold text-textMain">{post.title}</h1>
          {isEditing ? (
            <>
              <label className="mb-3 flex items-center justify-between rounded-xl border border-surface bg-surface/50 px-4 py-3">
                <span className="text-sm font-medium text-textMain">익명으로 작성</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnonymous}
                  onClick={() => setIsAnonymous((prev) => !prev)}
                  className={`relative h-7 w-12 rounded-full transition ${
                    isAnonymous ? "bg-primary" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                      isAnonymous ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="mb-4 min-h-[220px] w-full resize-none rounded-xl border border-surface bg-white px-4 py-4 text-[15px] text-textMain"
              />
              <PostImagePicker
                existingImages={uploadedImages}
                localImages={localImages}
                maxCount={POST_IMAGE_MAX_COUNT}
                disabled={isSubmitting || isUploadingImages}
                onAddFiles={onAddFiles}
                onRemoveExisting={async (imageId) => {
                  const isInitialImage = initialUploadedImageIdsRef.current.has(imageId);
                  if (isInitialImage) {
                    setUploadedImages((prev) => prev.filter((image) => image.id !== imageId));
                    return;
                  }

                  try {
                    await deletePostImage(postId, imageId);
                    setUploadedImages((prev) => prev.filter((image) => image.id !== imageId));
                  } catch (e) {
                    setSubmitError(e instanceof Error ? e.message : "이미지 삭제 중 오류가 발생했습니다.");
                  }
                }}
                onRemoveLocal={onRemoveLocalImage}
              />
            </>
          ) : (
            <>
              <PostImageGallery imageUrls={post.imageUrls} />
              <p className="mb-4 whitespace-pre-wrap text-[15px] text-textMain">{post.content}</p>
            </>
          )}
          {isUploadingImages ? (
            <p className="mb-3 text-sm text-textSub">이미지 업로드 중입니다...</p>
          ) : null}
          {submitError ? <p className="mb-3 text-sm text-red-600">{submitError}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <Button size="sm" variant={post.hasAmened ? "secondary" : "ghost"}>
              🙏 아멘 {post.amenCount}
            </Button>
            {canManage ? (
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={onSave} disabled={isSubmitting || isUploadingImages}>
                      {isSubmitting ? "저장 중..." : "저장"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setContent(post.content);
                        setIsAnonymous(post.isAnonymous);
                        setUploadedImages(
                          post.images.map((image) => ({
                            id: image.id,
                            publicUrl: image.publicUrl,
                            sortOrder: image.sortOrder,
                          }))
                        );
                        initialUploadedImageIdsRef.current = new Set(post.images.map((image) => image.id));
                        setIsEditing(false);
                        setSubmitError(null);
                        setLocalImages((prev) => {
                          for (const image of prev) revokeLocalPostImageDraft(image);
                          return [];
                        });
                      }}
                      disabled={isSubmitting}
                    >
                      취소
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      style={{ borderColor: "var(--ubique-primary)", color: "var(--ubique-primary)" }} 
                      onClick={() => setIsEditing(true)}
                    >
                      수정
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="border"
                      style={{ borderColor: "var(--ubique-fail)", color: "var(--ubique-fail)" }}
                      onClick={onDelete}
                      disabled={isSubmitting}
                    >
                      삭제
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </Card>

        <PostCommentsSection
          postId={postId}
          currentUserId={currentUserId}
          initialCommentCount={post.commentCount}
        />
      </main>

      <ScrollToTopButton
        threshold={240}
        bottomOffsetClassName="bottom-[calc(6.25rem+var(--ubique-safe-bottom))]"
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<PrayerDetailPageProps> = async (context) => {
  const postId = context.params?.id;
  if (typeof postId !== "string") {
    return {
      props: { post: null, canManage: false, currentUserId: null, error: "잘못된 요청입니다." },
    };
  }

  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    const post = await getPostById(postId, session?.user?.id ?? null);
    return {
      props: {
        post,
        canManage: Boolean(post && session?.user?.id && post.authorUserId === session.user.id),
        currentUserId: session?.user?.id ?? null,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return { props: { post: null, canManage: false, currentUserId: null, error: message } };
  }
};
