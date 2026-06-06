import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { detachImageFromPost } from "@/features/posts/server";
import { authOptions } from "@/lib/auth/options";

type DeletePostImageApiResponse =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

function parseId(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DeletePostImageApiResponse>
) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const postId = parseId(req.query.id);
  const imageId = parseId(req.query.imageId);
  if (!postId || !imageId) {
    return res.status(400).json({ ok: false, error: "잘못된 이미지 요청입니다." });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ ok: false, error: "로그인 후 이용 가능합니다." });
  }

  try {
    await detachImageFromPost({
      postId,
      imageId,
      authorUserId: session.user.id,
    });
    return res.status(200).json({ ok: true, data: { id: imageId } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    if (message === "POST_NOT_FOUND" || message === "IMAGE_NOT_FOUND") {
      return res.status(404).json({ ok: false, error: "이미지를 찾을 수 없습니다." });
    }
    if (message === "FORBIDDEN") {
      return res.status(403).json({ ok: false, error: "이미지 삭제 권한이 없습니다." });
    }
    return res.status(500).json({ ok: false, error: message });
  }
}
