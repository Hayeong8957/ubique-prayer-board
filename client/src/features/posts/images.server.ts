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

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error("INVALID_IMAGE_DATA");
  }

  const mimeType = match[1];
  const base64 = match[2];

  if (!POST_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType as (typeof POST_IMAGE_ALLOWED_MIME_TYPES)[number])) {
    throw new Error("UNSUPPORTED_IMAGE_TYPE");
  }

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) {
    throw new Error("EMPTY_IMAGE_DATA");
  }

  if (buffer.length > POST_IMAGE_MAX_SIZE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }

  return { mimeType, buffer };
}

function sanitizeBaseName(fileName?: string | null) {
  const raw = (fileName ?? "image").trim();
  const withoutExt = raw.replace(/\.[^.]+$/, "");
  const normalized = withoutExt.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^-|-$/g, "").slice(0, 40) || "image";
}

export async function uploadPostImage(input: {
  userId: string;
  dataUrl: string;
  fileName?: string | null;
}) {
  const { mimeType, buffer } = parseDataUrl(input.dataUrl);
  const extension = MIME_EXTENSION_MAP[mimeType] ?? "bin";
  const baseName = sanitizeBaseName(input.fileName);
  const date = new Date();
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const objectPath = `${input.userId}/${yyyy}/${mm}/${baseName}-${randomUUID()}.${extension}`;

  const supabaseAdmin = getSupabaseAdmin();
  const { error } = await supabaseAdmin.storage
    .from(POST_IMAGES_BUCKET)
    .upload(objectPath, buffer, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(POST_IMAGES_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}
