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
  POST_IMAGE_MAX_COUNT,
  revokeLocalPostImageDraft,
  uploadPostImages,
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
    }
  }

  function onRemoveLocalImage(id: string) {
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
      let nextUploadedImages = uploadedImages;

      if (localImages.length > 0) {
        const uploaded = await uploadPostImages(
          nextDraftId,
          localImages.map((image) => image.file)
        );
        nextUploadedImages = [...uploadedImages, ...uploaded];
      }

      const response = await fetch(`/api/posts/${nextDraftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          imageIds: nextUploadedImages.map((image) => image.id),
          isAnonymous,
        }),
      });

      const payload = (await response.json()) as CreatePostResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? "작성 중 오류가 발생했습니다." : payload.error);
        return;
      }

      setUploadedImages(nextUploadedImages);
      setLocalImages((prev) => {
        for (const image of prev) revokeLocalPostImageDraft(image);
        return [];
      });
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
              disabled={isSubmitting}
              onAddFiles={onAddFiles}
              onRemoveExisting={(imageId) =>
                setUploadedImages((prev) => prev.filter((image) => image.id !== imageId))
              }
              onRemoveLocal={onRemoveLocalImage}
            />
          </div>

          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

          <div className="mt-4 flex justify-end">
            <Button onClick={onSubmit} disabled={isSubmitting}>
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
