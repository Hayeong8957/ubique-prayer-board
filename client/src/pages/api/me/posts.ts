import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { listPostsByAuthorAndBoardCode } from "@/features/posts/server";
import type { BoardCode, PostListItem } from "@/features/posts/types";

type MePostsApiResponse =
  | { ok: true; data: PostListItem[] }
  | { ok: false; error: string };

function parseBoardCode(value: string | string[] | undefined): BoardCode {
  if (value === "sermon") return "sermon";
  if (value === "horeb") return "horeb";
  return "prayer";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MePostsApiResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const boardCode = parseBoardCode(req.query.boardType);

  try {
    const data = await listPostsByAuthorAndBoardCode(session.user.id, boardCode);
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return res.status(500).json({ ok: false, error: message });
  }
}
