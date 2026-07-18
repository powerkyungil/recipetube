import { jsonError } from "@/lib/request";
import { recipeMutationBodySchema } from "@/lib/recipe-schema";
import { getSupabaseAdmin, getUserIdFromRequest } from "@/lib/supabase-admin";
import {
  getSupabaseUserClient,
  isSupabaseAuthError,
} from "@/lib/supabase-request";

const recipeColumns =
  "id, youtube_video_id, source_url, title, recipe_json, created_at";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let body;

  try {
    body = recipeMutationBodySchema.parse(await request.json());
  } catch {
    return jsonError("레시피 입력 내용을 확인해 주세요.");
  }

  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const { id } = await context.params;
    const recipe = { ...body.recipe, title: body.title };
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("saved_recipes")
      .update({ title: body.title, recipe_json: recipe })
      .eq("id", id)
      .eq("user_id", userId)
      .select(recipeColumns)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return jsonError("수정할 레시피를 찾지 못했습니다.", 404);
    }

    return Response.json({ recipe: data });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "레시피 수정 중 오류가 발생했습니다.";
    return jsonError(message, 500);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = getSupabaseUserClient(request);

    if (!supabase) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const { id } = await context.params;
    const { error } = await supabase
      .from("saved_recipes")
      .delete()
      .eq("id", id);

    if (error) {
      if (isSupabaseAuthError(error)) {
        return jsonError("로그인이 필요합니다.", 401);
      }

      throw error;
    }

    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "레시피 삭제 중 오류가 발생했습니다.";
    return jsonError(message, 500);
  }
}
