import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type BoardItem = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
};

type BoardsApiResponse =
  | { ok: true; data: BoardItem[] }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BoardsApiResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("boards")
      .select("id,code,name,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return res.status(500).json({ ok: false, error: error.message });
    }

    return res.status(200).json({
      ok: true,
      data: (data ?? []).map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        sortOrder: item.sort_order,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return res.status(500).json({ ok: false, error: message });
  }
}
