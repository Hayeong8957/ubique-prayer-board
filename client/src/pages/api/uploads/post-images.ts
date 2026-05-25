import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { uploadPostImage } from "@/features/posts/images.server";
import { authOptions } from "@/lib/auth/options";

type UploadPostImageResponse =
  | { ok: true; data: { url: string } }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadPostImageResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ ok: false, error: "로그인 후 이용 가능합니다." });
  }

  const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : null;
  if (!dataUrl) {
    return res.status(400).json({ ok: false, error: "이미지 데이터가 없습니다." });
  }

  try {
    const url = await uploadPostImage({
      userId: session.user.id,
      dataUrl,
      fileName,
    });
    return res.status(201).json({ ok: true, data: { url } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    if (message === "INVALID_IMAGE_DATA" || message === "EMPTY_IMAGE_DATA") {
      return res.status(400).json({ ok: false, error: "올바른 이미지 파일이 아닙니다." });
    }
    if (message === "UNSUPPORTED_IMAGE_TYPE") {
      return res.status(400).json({ ok: false, error: "jpg, png, webp, gif만 업로드할 수 있습니다." });
    }
    if (message === "IMAGE_TOO_LARGE") {
      return res.status(400).json({ ok: false, error: "이미지는 5MB 이하만 업로드할 수 있습니다." });
    }
    return res.status(500).json({ ok: false, error: message });
  }
}
