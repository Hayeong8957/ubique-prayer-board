import type { NextApiRequest, NextApiResponse } from "next";
import { listCommentsByPostId } from "@/features/posts/server";
import type { CommentItem } from "@/features/posts/types";

type PostCommentsApiResponse =
  | { ok: true; data: CommentItem[] }
  | { ok: false; error: string };

function parsePostId(id: string | string[] | undefined) {
  if (typeof id !== "string" || !id.trim()) return null;
  return id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostCommentsApiResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const postId = parsePostId(req.query.id);
  if (!postId) {
    return res.status(400).json({ ok: false, error: "Invalid post id" });
  }

  try {
    const comments = await listCommentsByPostId(postId);
    return res.status(200).json({ ok: true, data: comments });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return res.status(500).json({ ok: false, error: message });
  }
}
