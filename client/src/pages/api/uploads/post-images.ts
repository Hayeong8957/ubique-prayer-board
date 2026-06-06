import type { NextApiRequest, NextApiResponse } from "next";

type UploadPostImageResponse = { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadPostImageResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  return res.status(410).json({
    ok: false,
    error: "이 업로드 경로는 더 이상 사용되지 않습니다.",
  });
}
