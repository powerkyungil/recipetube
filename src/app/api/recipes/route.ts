import { jsonError } from "@/lib/request";
import { getSupabaseAdmin, getUserIdFromRequest } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("saved_recipes")
      .select("id, youtube_video_id, source_url, title, recipe_json, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return Response.json({ recipes: data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "저장된 레시피를 불러오지 못했습니다.";
    return jsonError(message, 500);
  }
}
