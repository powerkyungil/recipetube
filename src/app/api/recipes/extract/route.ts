import { z } from "zod";
import {
  generateRecipeFromTranscript,
} from "@/lib/recipe-ai";
import { jsonError } from "@/lib/request";
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
export async function GET(request: Request) {
  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return Response.json({
        authenticated: false,
        usage: null,
        monthKey: null,
      });
    }

    const usage = await readUsage(getSupabaseAdmin(), {
      userId,
      anonymousId: null,
    });

    return Response.json(
      {
        authenticated: true,
        usage: {
          limit: usage.limit,
          used: usage.used,
          remaining: usage.remaining,
          subject: "user",
        },
        monthKey: usage.monthKey,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "사용량을 불러오지 못했습니다.";
    return jsonError(message, 500);
  }
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return jsonError("요청 형식이 올바르지 않습니다.");
  }

  try {
    const userId = await getUserIdFromRequest(request);

    if (!userId) {
      return jsonError(
        "레시피 추출은 로그인 후 이용할 수 있습니다. 아래 예시 결과를 먼저 확인해 보세요.",
        401,
      );
    }

    const parsed = parseYouTubeShortsUrl(body.url);

    if (!parsed.ok) {
      return jsonError(parsed.reason);
    }

    const supabase = getSupabaseAdmin();
    const subject = { userId, anonymousId: null };
    const beforeUsage = await readUsage(supabase, subject);

    if (beforeUsage.used >= beforeUsage.limit) {
      return jsonError(
        "이번 달 무료 추출 10회를 모두 사용했습니다. 다음 달 1일에 다시 이용할 수 있어요.",
        429,
      );
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
          subject: "user",
        },
      });
    }

    const [youtubeTitle, transcript] = await Promise.all([
      fetchYouTubeTitle(parsed.videoId),
      fetchYouTubeTranscript(parsed.videoId),
    ]);

    if (!transcript || transcript.length < 20) {
      return jsonError(
        "이 영상에는 사용할 수 있는 자막이 없습니다. 레시담은 자막이 제공되는 Shorts만 추출할 수 있어요.",
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
        subject: "user",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "레시피 추출 중 오류가 발생했습니다.";

    // Keep full detail in server logs for debugging.
    console.error("[/api/recipes/extract] unhandled error:", error);

    if (message.includes('relation "public.')) {
      return jsonError(
        "Supabase 테이블이 아직 생성되지 않았습니다. `supabase/schema.sql`을 DB에 먼저 적용해주세요.",
        500,
      );
    }

    if (
      /invalid[_\s-]?api[_\s-]?key|incorrect api key|401/i.test(message)
    ) {
      return jsonError(
        "OpenAI API 키가 유효하지 않거나 권한이 없습니다. `.env.local`의 `OPENAI_API_KEY`를 확인해주세요.",
        500,
      );
    }

    if (/insufficient_quota|quota|billing|429/i.test(message)) {
      return jsonError(
        "OpenAI 사용 한도를 초과했습니다. OpenAI 결제/크레딧 상태를 확인한 뒤 다시 시도해주세요.",
        429,
      );
    }

    if (/supabase|jwt|row level security|permission/i.test(message)) {
      return jsonError(
        "Supabase 인증 또는 권한 설정 문제입니다. 서비스 키와 RLS/정책 설정을 확인해주세요.",
        500,
      );
    }

    return jsonError(message, 500);
  }
}
