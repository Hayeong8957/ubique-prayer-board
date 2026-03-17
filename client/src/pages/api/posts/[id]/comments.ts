import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import {
  createComment,
  listCommentsByPostIdPaginated,
} from "@/features/posts/server";
import type { CommentItem, CommentPagination } from "@/features/posts/types";

type PostCommentsApiResponse =
  | { ok: true; data: CommentItem[]; pagination: CommentPagination }
  | { ok: false; error: string };

function parsePostId(id: string | string[] | undefined) {
  if (typeof id !== "string" || !id.trim()) return null;
  return id;
}

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  const target = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(target ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostCommentsApiResponse>
) {
  const postId = parsePostId(req.query.id);
  if (!postId) {
    return res.status(400).json({ ok: false, error: "Invalid post id" });
  }

  if (req.method === "GET") {
    try {
      const page = parsePositiveInt(req.query.page, 1);
      const pageSize = parsePositiveInt(req.query.pageSize, 5);
      const result = await listCommentsByPostIdPaginated(postId, page, pageSize);
      return res.status(200).json({ ok: true, data: result.items, pagination: result.pagination });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      return res.status(500).json({ ok: false, error: message });
    }
  }

  if (req.method === "POST") {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ ok: false, error: "로그인이 필요합니다." });
    }

    const content = typeof req.body?.content === "string" ? req.body.content : "";
    if (!content.trim()) {
      return res.status(400).json({ ok: false, error: "댓글 내용을 입력해주세요." });
    }

    try {
      const comment = await createComment({
        postId,
        authorUserId: session.user.id,
        content,
      });
      return res.status(201).json({
        ok: true,
        data: [comment],
        pagination: { page: 1, pageSize: 1, hasMore: false, nextPage: null },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      if (message === "POST_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "게시글을 찾을 수 없습니다." });
      }
      if (message === "Content is required") {
        return res.status(400).json({ ok: false, error: "댓글 내용을 입력해주세요." });
      }
      return res.status(500).json({ ok: false, error: message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
