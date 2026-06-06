import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { createPost, listPostsByBoardCodePaginated } from "@/features/posts/server";
import type { BoardCode, PostListItem } from "@/features/posts/types";
import { authOptions } from "@/lib/auth/options";

type PostsApiResponse =
  | {
      ok: true;
      data: PostListItem[];
      pagination: { page: number; pageSize: number; hasMore: boolean; nextPage: number | null };
    }
  | { ok: true; data: { id: string } }
  | { ok: false; error: string };

function parseBoardCode(value: string | string[] | undefined): BoardCode {
  if (value === "sermon") return "sermon";
  return "prayer";
}

function parsePositiveInt(value: string | string[] | undefined, fallback: number) {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostsApiResponse>
) {
  if (req.method === "GET") {
    const session = await getServerSession(req, res, authOptions);
    const boardCode = parseBoardCode(req.query.boardType);
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 10);

    try {
      const result = await listPostsByBoardCodePaginated(
        boardCode,
        page,
        pageSize,
        session?.user?.id ?? null
      );
      return res.status(200).json({
        ok: true,
        data: result.items,
        pagination: {
          page,
          pageSize,
          hasMore: result.hasMore,
          nextPage: result.hasMore ? page + 1 : null,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      return res.status(500).json({ ok: false, error: message });
    }
  }

  if (req.method === "POST") {
    const boardCode = parseBoardCode(req.body?.boardType);
    const title = typeof req.body?.title === "string" ? req.body.title : "";
    const scriptureText =
      typeof req.body?.scriptureText === "string" ? req.body.scriptureText : "";
    const content = typeof req.body?.content === "string" ? req.body.content : "";
    const isAnonymous = Boolean(req.body?.isAnonymous);

    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({
        ok: false,
        error: "로그인 후 이용 가능합니다.",
      });
    }

    try {
      const id = await createPost({
        boardCode,
        title,
        scriptureText,
        content,
        isAnonymous,
        authorUserId: session.user.id,
      });
      return res.status(201).json({ ok: true, data: { id } });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      const status = /required/i.test(message) ? 400 : 500;
      return res.status(status).json({ ok: false, error: message });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
