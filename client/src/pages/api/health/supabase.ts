import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type HealthResponse =
  | { ok: true; data: Array<{ code: string; name: string }> }
  | { ok: false; error: string };

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Missing environment variables";
    return res.status(500).json({ ok: false, error: message });
  }

  const { data, error } = await supabaseAdmin
    .from("boards")
    .select("code,name")
    .limit(3);

  if (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }

  return res.status(200).json({
    ok: true,
    data: (data ?? []) as Array<{ code: string; name: string }>,
  });
}
