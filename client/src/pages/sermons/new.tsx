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
} from "@/features/posts/images.client";
import { authOptions } from "@/lib/auth/options";

type CreatePostResponse =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

export default function NewSermonPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [scriptureText, setScriptureText] = useState("");
  const [content, setContent] = useState("");
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
    const totalCount = localImages.length;

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

  async function onSubmit() {
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!scriptureText.trim()) {
      setError("말씀을 입력해주세요.");
      return;
    }
    if (!content.trim()) {
      setError("본문을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const uploadedImageUrls = await uploadPostImages(localImages.map((image) => image.file));
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardType: "sermon",
          title,
          scriptureText,
          content,
          imageUrls: uploadedImageUrls,
          isAnonymous: false,
        }),
      });

      const payload = (await response.json()) as CreatePostResponse;
      if (!response.ok || !payload.ok) {
        setError(payload.ok ? "작성 중 오류가 발생했습니다." : payload.error);
        return;
      }

      await router.push(`/sermons/${payload.data.id}`);
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
          <Link href="/?board=sermon" className="text-sm font-medium text-primary">
            ← 주일 말씀 목록으로
          </Link>
        </div>

        <Card className="flex-1 p-4">
          <h1 className="mb-2 text-lg font-bold text-textMain">주일 말씀 작성</h1>
          <p className="mb-4 text-sm text-textSub">제목, 말씀, 본문을 입력해 주세요.</p>

          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="h-12 w-full rounded-xl border border-surface bg-white px-4 text-sm text-textMain placeholder:text-textSub"
            />
            <input
              value={scriptureText}
              onChange={(e) => setScriptureText(e.target.value)}
              placeholder="말씀 (예: 요한복음 3:16)"
              className="h-12 w-full rounded-xl border border-surface bg-white px-4 text-sm text-textMain placeholder:text-textSub"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="본문"
              className="min-h-[220px] w-full resize-none rounded-xl border border-surface bg-white px-4 py-4 text-base text-textMain placeholder:text-textSub"
            />
          </div>

          <div className="mt-4">
            <PostImagePicker
              localImages={localImages}
              maxCount={POST_IMAGE_MAX_COUNT}
              disabled={isSubmitting}
              onAddFiles={onAddFiles}
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
