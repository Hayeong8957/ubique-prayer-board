import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import {
  softDeleteCommentById,
  updateCommentById,
} from "@/features/posts/server";
import type { CommentItem, CommentPagination } from "@/features/posts/types";

type PostCommentMutationResponse =
  | { ok: true; data: CommentItem[]; pagination: CommentPagination }
  | { ok: false; error: string };

function parseQueryId(value: string | string[] | undefined) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostCommentMutationResponse>
) {
  const postId = parseQueryId(req.query.id);
  const commentId = parseQueryId(req.query.commentId);

  if (!postId || !commentId) {
    return res.status(400).json({ ok: false, error: "잘못된 요청입니다." });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ ok: false, error: "로그인이 필요합니다." });
  }

  if (req.method === "PUT") {
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    if (!content.trim()) {
      return res.status(400).json({ ok: false, error: "댓글 내용을 입력해주세요." });
    }

    try {
      const comment = await updateCommentById({
        commentId,
        postId,
        authorUserId: session.user.id,
        content,
      });
      return res.status(200).json({
        ok: true,
        data: [comment],
        pagination: { page: 1, pageSize: 1, hasMore: false, nextPage: null },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      if (message === "COMMENT_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "댓글을 찾을 수 없습니다." });
      }
      if (message === "FORBIDDEN") {
        return res.status(403).json({ ok: false, error: "수정 권한이 없습니다." });
      }
      if (message === "Content is required") {
        return res.status(400).json({ ok: false, error: "댓글 내용을 입력해주세요." });
      }
      return res.status(500).json({ ok: false, error: message });
    }
  }

  if (req.method === "DELETE") {
    try {
      await softDeleteCommentById({
        commentId,
        postId,
        authorUserId: session.user.id,
      });
      return res.status(200).json({
        ok: true,
        data: [],
        pagination: { page: 1, pageSize: 0, hasMore: false, nextPage: null },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      if (message === "COMMENT_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "댓글을 찾을 수 없습니다." });
      }
      if (message === "FORBIDDEN") {
        return res.status(403).json({ ok: false, error: "삭제 권한이 없습니다." });
      }
      return res.status(500).json({ ok: false, error: message });
    }
  }

  res.setHeader("Allow", "PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
