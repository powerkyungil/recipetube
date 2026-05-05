import { jsonError } from "@/lib/request";
import { getSupabaseAdmin, getUserIdFromRequest } from "@/lib/supabase-admin";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const { id } = await context.params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("saved_recipes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "레시피 삭제 중 오류가 발생했습니다.";
    return jsonError(message, 500);
  }
}
