import { z } from "zod";
import { jsonError } from "@/lib/request";
import { getSupabaseAdmin, getUserIdFromRequest } from "@/lib/supabase-admin";
import { SAVED_RECIPE_LIMIT } from "@/lib/usage";
import { parseYouTubeShortsUrl } from "@/lib/youtube";

const bodySchema = z.object({
  sourceUrl: z.string().min(1),
  title: z.string().min(1),
  recipe: z.unknown(),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return jsonError("요청 형식이 올바르지 않습니다.");
  }

  const parsed = parseYouTubeShortsUrl(body.sourceUrl);

  if (!parsed.ok) {
    return jsonError(parsed.reason);
  }

  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const supabase = getSupabaseAdmin();
    const { count, error: countError } = await supabase
      .from("saved_recipes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      throw countError;
    }

    if ((count ?? 0) >= SAVED_RECIPE_LIMIT) {
      return jsonError("무료회원은 레시피를 5개까지 저장할 수 있습니다.", 429);
    }

    const { data, error } = await supabase
      .from("saved_recipes")
      .insert({
        user_id: userId,
        youtube_video_id: parsed.videoId,
        source_url: parsed.canonicalUrl,
        title: body.title,
        recipe_json: body.recipe,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return jsonError("이미 저장한 레시피입니다.", 409);
      }

      throw error;
    }

    return Response.json({ id: data.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "레시피 저장 중 오류가 발생했습니다.";
    return jsonError(message, 500);
  }
}
