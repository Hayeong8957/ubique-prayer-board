export const POST_IMAGE_MAX_COUNT = 4;
export const POST_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export interface LocalPostImageDraft {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "failed";
}

export interface UploadedPostImage {
  id: string;
  publicUrl: string;
  sortOrder: number;
}

type UploadResponse = { ok: true; data: UploadedPostImage } | { ok: false; error: string };
type DeleteResponse = { ok: true; data: { id: string } } | { ok: false; error: string };

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
    status: "uploading",
  };
}

export function revokeLocalPostImageDraft(draft: LocalPostImageDraft) {
  URL.revokeObjectURL(draft.previewUrl);
}

export async function uploadPostImage(postId: string, file: File, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/posts/${postId}/images`, {
    method: "POST",
    body: formData,
    signal,
  });

  const payload = (await response.json()) as UploadResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "이미지 업로드 중 오류가 발생했습니다." : payload.error);
  }

  return payload.data;
}

export async function deletePostImage(postId: string, imageId: string) {
  const response = await fetch(`/api/posts/${postId}/images/${imageId}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as DeleteResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "이미지 삭제 중 오류가 발생했습니다." : payload.error);
  }

  return payload.data;
}
