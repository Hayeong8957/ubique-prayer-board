import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { getPostById } from "@/features/posts/server";
import type { PostDetail } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

type PostDetailApiResponse =
  | { ok: true; data: PostDetail }
  | { ok: false; error: string };

function parsePostId(id: string | string[] | undefined) {
  if (typeof id !== "string" || !id.trim()) return null;
  return id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostDetailApiResponse>
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
