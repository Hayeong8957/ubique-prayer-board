import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { createDraftPost } from "@/features/posts/server";
import type { BoardCode } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

type DraftPostApiResponse =
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

function parseBoardCode(value: unknown): BoardCode | null {
  if (value === "prayer" || value === "sermon" || value === "horeb") return value;
  return null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DraftPostApiResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ ok: false, error: "로그인 후 이용 가능합니다." });
  }

  const boardCode = parseBoardCode(req.body?.boardType);
  if (!boardCode) {
    return res.status(400).json({ ok: false, error: "유효하지 않은 게시판입니다." });
  }

  try {
    const id = await createDraftPost({
      boardCode,
      authorUserId: session.user.id,
    });
    return res.status(201).json({ ok: true, data: { id } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return res.status(500).json({ ok: false, error: message });
  }
}
