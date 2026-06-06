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
  POST_IMAGE_MAX_COUNT,
  revokeLocalPostImageDraft,
  uploadPostImages,
  validatePostImageFile,
  type LocalPostImageDraft,
  type UploadedPostImage,
} from "@/features/posts/images.client";
import { getPostById } from "@/features/posts/server";
import type { PostDetail } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

interface SermonDetailPageProps {
  post: PostDetail | null;
  canManage: boolean;
  currentUserId: string | null;
  error?: string;
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

export default function SermonDetailPage({
  post,
  canManage,
  currentUserId,
  error,
}: SermonDetailPageProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(post?.title ?? "");
  const [scriptureText, setScriptureText] = useState(post?.scriptureText ?? "");
  const [content, setContent] = useState(post?.content ?? "");
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

  useEffect(() => {
    localImagesRef.current = localImages;
  }, [localImages]);

  useEffect(() => {
    return () => {
      for (const image of localImagesRef.current) {
        revokeLocalPostImageDraft(image);
      }
    };
  }, []);

  function onAddFiles(files: File[]) {
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
    }
  }

  function onRemoveLocalImage(id: string) {
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
    if (!title.trim()) {
      setSubmitError("제목을 입력해주세요.");
      return;
    }
    if (!scriptureText.trim()) {
      setSubmitError("말씀을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setSubmitError("본문을 입력해주세요.");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      let nextUploadedImages = uploadedImages;
      if (localImages.length > 0) {
        const uploaded = await uploadPostImages(
          postId,
          localImages.map((image) => image.file)
        );
        nextUploadedImages = [...uploadedImages, ...uploaded];
      }
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          scriptureText,
          content,
          imageIds: nextUploadedImages.map((image) => image.id),
        }),
      });
      const payload = (await response.json()) as UpdatePostResponse;
      if (!response.ok || !payload.ok) {
        setSubmitError(payload.ok ? "수정 중 오류가 발생했습니다." : payload.error);
        return;
      }
      setUploadedImages(nextUploadedImages);
      setLocalImages((prev) => {
        for (const image of prev) revokeLocalPostImageDraft(image);
        return [];
      });
      setIsEditing(false);
      await router.replace(router.asPath);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    const ok = window.confirm("이 주일 말씀을 삭제할까요?");
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
      await router.push("/?board=sermon");
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
          <Link href="/?board=sermon" className="text-sm font-medium text-primary">
            ← 주일 말씀 목록으로
          </Link>
        </div>
      </div>

      <main className="mx-auto w-full max-w-2xl px-4 pt-4">

        <Card className="mb-3 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-textMain">{post.authorName}</p>
            <span className="text-xs text-textSub">{formatFullDate(post.createdAt)}</span>
          </div>
          {isEditing ? (
            <>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="제목"
                className="mb-3 h-12 w-full rounded-xl border border-surface bg-white px-4 text-sm text-textMain"
              />
              <input
                value={scriptureText}
                onChange={(event) => setScriptureText(event.target.value)}
                placeholder="말씀"
                className="mb-3 h-12 w-full rounded-xl border border-surface bg-white px-4 text-sm text-textMain"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="mb-4 min-h-[220px] w-full resize-none rounded-xl border border-surface bg-white px-4 py-4 text-[15px] text-textMain"
              />
              <PostImagePicker
                existingImages={uploadedImages}
                localImages={localImages}
                maxCount={POST_IMAGE_MAX_COUNT}
                disabled={isSubmitting}
                onAddFiles={onAddFiles}
                onRemoveExisting={(imageId) =>
                  setUploadedImages((prev) => prev.filter((image) => image.id !== imageId))
                }
                onRemoveLocal={onRemoveLocalImage}
              />
            </>
          ) : (
            <>
              <h1 className="mb-2 text-lg font-bold text-textMain">{post.title}</h1>
              {post.scriptureText ? (
                <p className="mb-3 text-sm font-medium text-textSub">{post.scriptureText}</p>
              ) : null}
              <PostImageGallery imageUrls={post.imageUrls} />
              <p className="mb-4 whitespace-pre-wrap text-[15px] text-textMain">{post.content}</p>
            </>
          )}
          {submitError ? <p className="mb-3 text-sm text-red-600">{submitError}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <Button size="sm" variant={post.hasAmened ? "secondary" : "ghost"}>
              🙏 아멘 {post.amenCount}
            </Button>
            {canManage ? (
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button size="sm" onClick={onSave} disabled={isSubmitting}>
                      {isSubmitting ? "저장 중..." : "저장"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTitle(post.title);
                        setScriptureText(post.scriptureText ?? "");
                        setContent(post.content);
                        setUploadedImages(
                          post.images.map((image) => ({
                            id: image.id,
                            publicUrl: image.publicUrl,
                            sortOrder: image.sortOrder,
                          }))
                        );
                        setSubmitError(null);
                        setIsEditing(false);
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

export const getServerSideProps: GetServerSideProps<SermonDetailPageProps> = async (context) => {
  const postId = context.params?.id;
  if (typeof postId !== "string") {
    return {
      props: { post: null, canManage: false, currentUserId: null, error: "잘못된 요청입니다." },
    };
  }

  try {
    const session = await getServerSession(context.req, context.res, authOptions);
    const post = await getPostById(postId, session?.user?.id ?? null);
    if (!post || post.boardCode !== "sermon") {
      return {
        props: {
          post: null,
          canManage: false,
          currentUserId: session?.user?.id ?? null,
          error: "주일 말씀 게시글이 아닙니다.",
        },
      };
    }
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
