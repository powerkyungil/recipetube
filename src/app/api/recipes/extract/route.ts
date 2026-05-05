import { z } from "zod";
import { generateRecipeFromTranscript } from "@/lib/recipe-ai";
import { getAnonymousId, jsonError } from "@/lib/request";
import { getSupabaseAdmin, getUserIdFromRequest } from "@/lib/supabase-admin";
import { incrementUsage, readUsage } from "@/lib/usage";
import {
  fetchYouTubeTitle,
  fetchYouTubeTranscript,
  parseYouTubeShortsUrl,
} from "@/lib/youtube";
import type { Recipe } from "@/types/recipe";

const bodySchema = z.object({
  url: z.string().min(1),
});

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return jsonError("요청 형식이 올바르지 않습니다.");
  }

  const parsed = parseYouTubeShortsUrl(body.url);

  if (!parsed.ok) {
    return jsonError(parsed.reason);
  }

  try {
    const supabase = getSupabaseAdmin();
    const userId = await getUserIdFromRequest(request);
    const anonymousId = userId ? null : getAnonymousId(request);

    if (!userId && !anonymousId) {
      return jsonError("비로그인 사용량 확인을 위한 anonymous id가 필요합니다.");
    }

    const subject = { userId, anonymousId };
    const beforeUsage = await readUsage(supabase, subject);

    if (beforeUsage.used >= beforeUsage.limit) {
      return jsonError("이번 달 무료 추출 횟수를 모두 사용했습니다.", 429);
    }

    const { data: cached, error: cacheError } = await supabase
      .from("video_cache")
      .select("youtube_title, recipe_json")
      .eq("youtube_video_id", parsed.videoId)
      .maybeSingle();

    if (cacheError) {
      throw cacheError;
    }

    if (cached) {
      const usage = await incrementUsage(supabase, subject);

      return Response.json({
        recipe: cached.recipe_json as Recipe,
        source: {
          url: body.url,
          canonicalUrl: parsed.canonicalUrl,
          youtubeVideoId: parsed.videoId,
          youtubeTitle: cached.youtube_title,
          fromCache: true,
        },
        usage: {
          limit: usage.limit,
          used: usage.used,
          remaining: usage.remaining,
          subject: userId ? "user" : "anonymous",
        },
      });
    }

    const [youtubeTitle, transcript] = await Promise.all([
      fetchYouTubeTitle(parsed.videoId),
      fetchYouTubeTranscript(parsed.videoId),
    ]);

    if (!transcript || transcript.length < 20) {
      return jsonError(
        "이 Shorts에서 사용할 수 있는 자막을 찾지 못했습니다. 현재 MVP는 자막이 있는 Shorts만 분석합니다.",
        422,
      );
    }

    const recipe = await generateRecipeFromTranscript({
      youtubeTitle,
      transcript,
    });

    const { error: insertCacheError } = await supabase
      .from("video_cache")
      .insert({
        youtube_video_id: parsed.videoId,
        source_url: parsed.canonicalUrl,
        youtube_title: youtubeTitle,
        transcript,
        recipe_json: recipe,
      });

    if (insertCacheError) {
      throw insertCacheError;
    }

    const usage = await incrementUsage(supabase, subject);

    return Response.json({
      recipe,
      source: {
        url: body.url,
        canonicalUrl: parsed.canonicalUrl,
        youtubeVideoId: parsed.videoId,
        youtubeTitle,
        fromCache: false,
      },
      usage: {
        limit: usage.limit,
        used: usage.used,
        remaining: usage.remaining,
        subject: userId ? "user" : "anonymous",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "레시피 추출 중 오류가 발생했습니다.";

    return jsonError(message, 500);
  }
}
