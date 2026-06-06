import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { getPostById, softDeletePostById, updatePostById } from "@/features/posts/server";
import type { PostDetail } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

type PostDetailApiResponse =
  | { ok: true; data: PostDetail }
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

function parsePostId(id: string | string[] | undefined) {
  if (typeof id !== "string" || !id.trim()) return null;
  return id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostDetailApiResponse>
) {
  const postId = parsePostId(req.query.id);
  if (!postId) {
    return res.status(400).json({ ok: false, error: "Invalid post id" });
  }

  if (req.method === "GET") {
    try {
      const session = await getServerSession(req, res, authOptions);
      const post = await getPostById(postId, session?.user?.id ?? null);
      if (!post) {
        return res.status(404).json({ ok: false, error: "Post not found" });
      }

      return res.status(200).json({ ok: true, data: post });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      return res.status(500).json({ ok: false, error: message });
    }
  }

  if (req.method === "PUT") {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ ok: false, error: "로그인 후 이용 가능합니다." });
    }

    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    const scriptureText =
      typeof req.body?.scriptureText === "string" ? req.body.scriptureText : "";
    const imageIds = Array.isArray(req.body?.imageIds)
      ? req.body.imageIds.filter((value: unknown): value is string => typeof value === "string")
      : undefined;
    const isAnonymous =
      typeof req.body?.isAnonymous === "boolean" ? req.body.isAnonymous : undefined;

    try {
      await updatePostById({
        postId,
        authorUserId: session.user.id,
        title,
        scriptureText,
        content,
        imageIds,
        isAnonymous,
      });
      return res.status(200).json({ ok: true, data: { id: postId } });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      if (message === "FORBIDDEN") {
        return res.status(403).json({ ok: false, error: "본인 글만 수정할 수 있습니다." });
      }
      if (message === "POST_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "Post not found" });
      }
      if (message === "INVALID_IMAGE_IDS") {
        return res.status(400).json({ ok: false, error: "유효하지 않은 이미지 요청입니다." });
      }
      if (/required/i.test(message) || /limit/i.test(message)) {
        return res.status(400).json({ ok: false, error: message });
      }
      return res.status(500).json({ ok: false, error: message });
    }
  }

  if (req.method === "DELETE") {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ ok: false, error: "로그인 후 이용 가능합니다." });
    }

    try {
      await softDeletePostById(postId, session.user.id);
      return res.status(200).json({ ok: true, data: { id: postId } });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      if (message === "FORBIDDEN") {
        return res.status(403).json({ ok: false, error: "본인 글만 삭제할 수 있습니다." });
      }
      if (message === "POST_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "Post not found" });
      }
      return res.status(500).json({ ok: false, error: message });
    }
  }

  res.setHeader("Allow", "GET, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
