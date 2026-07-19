import {
  getOrCreateAccountProfile,
  isValidNickname,
  normalizeNickname,
} from "@/lib/account-profile";
import { jsonError } from "@/lib/request";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    return Response.json({ profile: await getOrCreateAccountProfile(user) });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "계정 정보를 불러오지 못했습니다.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const body = await request.json();
    const nickname = typeof body.nickname === "string" ? normalizeNickname(body.nickname) : "";

    if (!isValidNickname(nickname)) {
      return jsonError("닉네임은 공백 없이 한글·영문·숫자 2~16자로 입력해 주세요.");
    }

    await getOrCreateAccountProfile(user);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select("id, nickname")
      .single();

    if (error?.code === "23505") {
      return jsonError("이미 사용 중인 닉네임입니다.", 409);
    }

    if (error) {
      throw error;
    }

    return Response.json({ profile: { ...data, email: user.email ?? "" } });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "닉네임을 변경하지 못했습니다.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user?.email) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const body = await request.json();
    const confirmationEmail = typeof body.confirmationEmail === "string" ? body.confirmationEmail.trim().toLowerCase() : "";

    if (confirmationEmail !== user.email.toLowerCase()) {
      return jsonError("가입한 이메일을 정확히 입력해 주세요.");
    }

    const supabase = getSupabaseAdmin();
    const [recipesResult, usageResult] = await Promise.all([
      supabase.from("saved_recipes").delete().eq("user_id", user.id),
      supabase.from("usage_records").delete().eq("user_id", user.id),
    ]);

    if (recipesResult.error) {
      throw recipesResult.error;
    }
    if (usageResult.error) {
      throw usageResult.error;
    }

    const { error } = await supabase.auth.admin.deleteUser(user.id);

    if (error) {
      throw error;
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "회원 탈퇴를 완료하지 못했습니다.", 500);
  }
}
