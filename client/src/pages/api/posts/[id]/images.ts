import { readFile } from "fs/promises";
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import formidable from "formidable";
import { POST_IMAGE_MAX_SIZE_BYTES, uploadPostImage } from "@/features/posts/images.server";
import { attachImageToPost } from "@/features/posts/server";
import type { PostImageItem } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

type PostImageUploadApiResponse =
  | { ok: true; data: PostImageItem }
  | { ok: false; error: string };
type ParsedUploadFile = {
  filepath: string;
  mimetype?: string | null;
  originalFilename?: string | null;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

function parsePostId(id: string | string[] | undefined) {
  if (typeof id !== "string" || !id.trim()) return null;
  return id;
}

async function parseMultipartForm(req: NextApiRequest) {
  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: POST_IMAGE_MAX_SIZE_BYTES,
    allowEmptyFiles: false,
  });

  return await new Promise<{ files: { file?: ParsedUploadFile | ParsedUploadFile[] } }>(
    (resolve, reject) => {
    form.parse(req, (error, _fields, files) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ files });
    });
    }
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostImageUploadApiResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const postId = parsePostId(req.query.id);
  if (!postId) {
    return res.status(400).json({ ok: false, error: "잘못된 게시글 요청입니다." });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ ok: false, error: "로그인 후 이용 가능합니다." });
  }

  try {
    const { files } = await parseMultipartForm(req);
    const parsedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!parsedFile) {
      return res.status(400).json({ ok: false, error: "이미지 파일이 없습니다." });
    }

    const mimeType = parsedFile.mimetype ?? "";
    const buffer = await readFile(parsedFile.filepath);
    const uploadResult = await uploadPostImage({
      postId,
      buffer,
      mimeType,
      fileName: parsedFile.originalFilename,
    });
    const image = await attachImageToPost({
      postId,
      authorUserId: session.user.id,
      objectPath: uploadResult.objectPath,
      publicUrl: uploadResult.publicUrl,
    });

    return res.status(201).json({ ok: true, data: image });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    if (message === "POST_NOT_FOUND") {
      return res.status(404).json({ ok: false, error: "게시글을 찾을 수 없습니다." });
    }
    if (message === "FORBIDDEN") {
      return res.status(403).json({ ok: false, error: "본인 글에만 이미지를 추가할 수 있습니다." });
    }
    if (message === "UNSUPPORTED_IMAGE_TYPE") {
      return res.status(400).json({ ok: false, error: "jpg, png, webp, gif만 업로드할 수 있습니다." });
    }
    if (message === "IMAGE_TOO_LARGE" || message.includes("maxFileSize")) {
      return res.status(400).json({ ok: false, error: "이미지는 5MB 이하만 업로드할 수 있습니다." });
    }
    if (message === "EMPTY_IMAGE_DATA") {
      return res.status(400).json({ ok: false, error: "올바른 이미지 파일이 아닙니다." });
    }
    if (message === "IMAGE_LIMIT_EXCEEDED") {
      return res.status(400).json({ ok: false, error: "이미지는 최대 4장까지 첨부할 수 있습니다." });
    }
    return res.status(500).json({ ok: false, error: message });
  }
}
