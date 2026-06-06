import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { PostImagePicker } from "@/components/posts/PostImagePicker";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
import { authOptions } from "@/lib/auth/options";

type CreatePostResponse =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

export default function NewPrayerPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedPostImage[]>([]);
  const [localImages, setLocalImages] = useState<LocalPostImageDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localImagesRef = useRef<LocalPostImageDraft[]>([]);
  const uploadControllersRef = useRef<Record<string, AbortController>>({});
  const draftIdRef = useRef<string | null>(null);
  const didPublishRef = useRef(false);
  const cleanupRequestedRef = useRef(false);

  useEffect(() => {
    localImagesRef.current = localImages;
  }, [localImages]);

  useEffect(() => {
    draftIdRef.current = draftId;
  }, [draftId]);

  function requestDraftCleanup() {
    if (didPublishRef.current || cleanupRequestedRef.current) return;
    const currentDraftId = draftIdRef.current;
    if (!currentDraftId) return;

    cleanupRequestedRef.current = true;
    Object.values(uploadControllersRef.current).forEach((controller) => controller.abort());
    void fetch(`/api/posts/${currentDraftId}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {
      cleanupRequestedRef.current = false;
    });
  }

  useEffect(() => {
    const onPageHide = () => {
      requestDraftCleanup();
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      requestDraftCleanup();
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
        setError(`이미지는 최대 ${POST_IMAGE_MAX_COUNT}장까지 첨부할 수 있습니다.`);
        break;
      }

      const validationError = validatePostImageFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      nextDrafts.push(createLocalPostImageDraft(file));
    }

    if (nextDrafts.length > 0) {
      setError(null);
      setLocalImages((prev) => [...prev, ...nextDrafts]);
      try {
        const nextDraftId = await ensureDraftId();
        nextDrafts.forEach((draft) => {
          const controller = new AbortController();
          uploadControllersRef.current[draft.id] = controller;

          void uploadPostImage(nextDraftId, draft.file, controller.signal)
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
              setError(e instanceof Error ? e.message : "이미지 업로드 중 오류가 발생했습니다.");
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "이미지 업로드 중 오류가 발생했습니다.");
        setLocalImages((prev) =>
          prev.map((image) =>
            nextDrafts.some((draft) => draft.id === image.id) ? { ...image, status: "failed" } : image
          )
        );
      }
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

  async function ensureDraftId() {
    if (draftId) return draftId;

    const response = await fetch("/api/posts/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardType: "prayer" }),
    });
    const payload = (await response.json()) as CreatePostResponse;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.ok ? "초안 생성 중 오류가 발생했습니다." : payload.error);
    }

    setDraftId(payload.data.id);
    return payload.data.id;
  }

  async function onSubmit() {
    if (!content.trim()) {
      setError("본문을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const nextDraftId = await ensureDraftId();

      const response = await fetch(`/api/posts/${nextDraftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          imageIds: uploadedImages.map((image) => image.id),
          isAnonymous,
        }),
      });

      const payload = (await response.json()) as CreatePostResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? "작성 중 오류가 발생했습니다." : payload.error);
        return;
      }

      didPublishRef.current = true;
      await router.push(`/prayers/${payload.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-8 pt-4">
        <div className="mb-3">
          <Link href="/?board=prayer" className="text-sm font-medium text-primary">
            ← 기도제목 목록으로
          </Link>
        </div>

        <Card className="flex-1 p-4">
          <h1 className="mb-2 text-lg font-bold text-textMain">기도제목 작성</h1>
          <p className="mb-4 text-sm text-textSub">나를 숨기고 기도 공유하기를 선택할 수 있어요.</p>

          <label className="mb-4 flex items-center justify-between rounded-xl border border-surface bg-surface/50 px-4 py-3">
            <span className="text-sm font-medium text-textMain">나를 숨기고 기도 공유하기</span>
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
            onChange={(e) => setContent(e.target.value)}
            placeholder="기도제목을 자유롭게 작성해 주세요."
            className="min-h-[260px] w-full resize-none rounded-[var(--radius-toss)] border border-surface bg-white px-4 py-4 text-base text-textMain placeholder:text-textSub"
          />

          <div className="mt-4">
            <PostImagePicker
              existingImages={uploadedImages}
              localImages={localImages}
              maxCount={POST_IMAGE_MAX_COUNT}
              disabled={isSubmitting || isUploadingImages}
              onAddFiles={onAddFiles}
              onRemoveExisting={async (imageId) => {
                if (!draftId) {
                  setUploadedImages((prev) => prev.filter((image) => image.id !== imageId));
                  return;
                }
                try {
                  await deletePostImage(draftId, imageId);
                  setUploadedImages((prev) => prev.filter((image) => image.id !== imageId));
                } catch (e) {
                  setError(e instanceof Error ? e.message : "이미지 삭제 중 오류가 발생했습니다.");
                }
              }}
              onRemoveLocal={onRemoveLocalImage}
            />
          </div>

          {isUploadingImages ? (
            <p className="mt-3 text-sm text-textSub">이미지 업로드 중입니다...</p>
          ) : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-4 flex justify-end">
            <Button onClick={onSubmit} disabled={isSubmitting || isUploadingImages}>
              {isSubmitting ? "등록 중..." : "등록하기"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return { props: {} };
};
