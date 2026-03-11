import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { togglePostAmen } from "@/features/posts/server";

type AmenApiResponse =
  | { ok: true; data: { amenCount: number; hasAmened: boolean } }
  | { ok: false; error: string };

function parsePostId(id: string | string[] | undefined) {
  if (typeof id !== "string" || !id.trim()) return null;
  return id;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AmenApiResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ ok: false, error: "로그인 후 이용 가능합니다." });
  }

  const postId = parsePostId(req.query.id);
  if (!postId) {
    return res.status(400).json({ ok: false, error: "Invalid post id" });
  }

  try {
    const data = await togglePostAmen(postId, session.user.id);
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return res.status(500).json({ ok: false, error: message });
  }
}
