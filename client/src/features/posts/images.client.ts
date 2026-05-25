export const POST_IMAGE_MAX_COUNT = 4;
export const POST_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface LocalPostImageDraft {
  id: string;
  file: File;
  previewUrl: string;
}

type UploadResponse = { ok: true; data: { url: string } } | { ok: false; error: string };

export function validatePostImageFile(file: File) {
  if (!POST_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return "jpg, png, webp, gif만 업로드할 수 있습니다.";
  }
  if (file.size > POST_IMAGE_MAX_SIZE_BYTES) {
    return "이미지는 5MB 이하만 업로드할 수 있습니다.";
  }
  return null;
}

export function createLocalPostImageDraft(file: File): LocalPostImageDraft {
  return {
    id: crypto.randomUUID(),
    file,
    previewUrl: URL.createObjectURL(file),
  };
}

export function revokeLocalPostImageDraft(draft: LocalPostImageDraft) {
  URL.revokeObjectURL(draft.previewUrl);
}

export async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };
    reader.onerror = () => reject(new Error("이미지 파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

export async function uploadPostImages(files: File[]) {
  const uploadedUrls: string[] = [];

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    const response = await fetch("/api/uploads/post-images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataUrl,
        fileName: file.name,
      }),
    });

    const payload = (await response.json()) as UploadResponse;
    if (!response.ok || !payload.ok) {
      throw new Error(payload.ok ? "이미지 업로드 중 오류가 발생했습니다." : payload.error);
    }

    uploadedUrls.push(payload.data.url);
  }

  return uploadedUrls;
}
