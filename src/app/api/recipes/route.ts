import { jsonError } from "@/lib/request";
import { recipeMutationBodySchema } from "@/lib/recipe-schema";
import { getSupabaseAdmin, getUserIdFromRequest } from "@/lib/supabase-admin";
import {
  getSupabaseUserClient,
  isSupabaseAuthError,
} from "@/lib/supabase-request";

const recipeColumns =
  "id, youtube_video_id, source_url, title, recipe_json, created_at";

export async function GET(request: Request) {
  const startedAt = performance.now();

  try {
    const supabase = getSupabaseUserClient(request);

    if (!supabase) {
      return jsonError("로그인이 필요합니다.", 401);
    }

    const queryStartedAt = performance.now();
    const { data, error } = await supabase
      .from("saved_recipes")
      .select(recipeColumns)
      .order("created_at", { ascending: false });
    const queryDuration = performance.now() - queryStartedAt;

    if (error) {
      if (isSupabaseAuthError(error)) {
        return jsonError("로그인이 필요합니다.", 401);
      }

      throw error;
    }

    return Response.json(
      { recipes: data },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Server-Timing": [
            `db;dur=${queryDuration.toFixed(1)}`,
            `total;dur=${(performance.now() - startedAt).toFixed(1)}`,
          ].join(", "),
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "저장된 레시피를 불러오지 못했습니다.";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
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

    const manualId = crypto.randomUUID();
    const recipe = { ...body.recipe, title: body.title };
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("saved_recipes")
      .insert({
        user_id: userId,
        youtube_video_id: `manual:${manualId}`,
        source_url: `manual://recipe/${manualId}`,
        title: body.title,
        recipe_json: recipe,
      })
      .select(recipeColumns)
      .single();

    if (error) {
      throw error;
    }

    return Response.json({ recipe: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "레시피 저장 중 오류가 발생했습니다.";
    return jsonError(message, 500);
  }
}
