import { getSupabaseAdmin } from "@/lib/supabase/server";

type UserIdRow = { id: string };

export async function findActiveUserIdByKakaoId(kakaoId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("kakao_id", kakaoId)
    .is("deleted_at", null)
    .maybeSingle<UserIdRow>();

  if (error) {
    throw new Error(`Failed to find user by kakao id: ${error.message}`);
  }

  return data?.id ?? null;
}

interface UpsertKakaoUserInput {
  kakaoId: string;
  name: string;
  email?: string | null;
  imageUrl?: string | null;
}

export async function upsertUserFromKakao(input: UpsertKakaoUserInput) {
  const supabaseAdmin = getSupabaseAdmin();
  const normalizedEmail = input.email?.trim().toLowerCase() || null;
  const now = new Date().toISOString();

  const byKakaoId = await findActiveUserIdByKakaoId(input.kakaoId);
  if (byKakaoId) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        email: normalizedEmail,
        name: input.name,
        image_url: input.imageUrl ?? null,
        is_active: true,
        deleted_at: null,
        last_login_at: now,
      })
      .eq("id", byKakaoId);

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
    return byKakaoId;
  }

  let existingUserId: string | null = null;
  if (normalizedEmail) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .is("deleted_at", null)
      .maybeSingle<UserIdRow>();

    if (error) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
    existingUserId = data?.id ?? null;
  }

  if (existingUserId) {
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        email: normalizedEmail,
        kakao_id: input.kakaoId,
        name: input.name,
        image_url: input.imageUrl ?? null,
        is_active: true,
        deleted_at: null,
        last_login_at: now,
      })
      .eq("id", existingUserId);

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
    return existingUserId;
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .insert({
      email: normalizedEmail,
      kakao_id: input.kakaoId,
      name: input.name,
      image_url: input.imageUrl ?? null,
      role: "member",
      is_active: true,
      last_login_at: now,
    })
    .select("id")
    .single<UserIdRow>();

  if (error || !data) {
    throw new Error(`Failed to create user: ${error?.message ?? "unknown error"}`);
  }

  return data.id;
}
