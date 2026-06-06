import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const POST_IMAGES_BUCKET = "post-images";
export const POST_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function normalizeMimeType(mimeType: string) {
  const normalized = mimeType.trim().toLowerCase();
  if (
    !POST_IMAGE_ALLOWED_MIME_TYPES.includes(
      normalized as (typeof POST_IMAGE_ALLOWED_MIME_TYPES)[number]
    )
  ) {
    throw new Error("UNSUPPORTED_IMAGE_TYPE");
  }
  return normalized;
}

function resolveExtension(mimeType: string, fileName?: string | null) {
  const fromName = (fileName ?? "").trim().match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  return MIME_EXTENSION_MAP[mimeType] ?? "bin";
}

export async function uploadPostImage(input: {
  postId: string;
  buffer: Buffer;
  mimeType: string;
  fileName?: string | null;
}) {
  const mimeType = normalizeMimeType(input.mimeType);
  if (!input.buffer.length) {
    throw new Error("EMPTY_IMAGE_DATA");
  }
  if (input.buffer.length > POST_IMAGE_MAX_SIZE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  const extension = resolveExtension(mimeType, input.fileName);
  const objectPath = `posts/${input.postId}/${randomUUID()}.${extension}`;

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(POST_IMAGES_BUCKET).upload(objectPath, input.buffer, {
    contentType: mimeType,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(POST_IMAGES_BUCKET).getPublicUrl(objectPath);
  return {
    objectPath,
    publicUrl: data.publicUrl,
  };
}
