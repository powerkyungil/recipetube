import { getOrCreateAccountProfile } from "@/lib/account-profile";
import { jsonError } from "@/lib/request";
import { getSupabaseAdmin, getUserFromRequest } from "@/lib/supabase-admin";

const MEMBERS_PER_PAGE = 10;

export async function GET(request: Request) {
  try {
    const adminUser = await getUserFromRequest(request);

    if (!adminUser) {
      return jsonError("관리자 로그인이 필요합니다.", 401);
    }

    const email = adminUser.email?.trim().toLowerCase();

    if (!email || !readAdminEmails().includes(email)) {
      return jsonError("관리자 권한이 없는 계정입니다.", 403);
    }

    const requestedPage = Number.parseInt(new URL(request.url).searchParams.get("page") ?? "1", 10);
    const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
    const supabase = getSupabaseAdmin();

    const [usersResult, savedRecipeTotalResult, aiRecipeTotalResult] = await Promise.all([
      supabase.auth.admin.listUsers({ page, perPage: MEMBERS_PER_PAGE }),
      supabase.from("saved_recipes").select("id", { count: "exact", head: true }),
      supabase.from("video_cache").select("id", { count: "exact", head: true }),
    ]);

    if (usersResult.error) {
      throw usersResult.error;
    }
    if (savedRecipeTotalResult.error) {
      throw savedRecipeTotalResult.error;
    }
    if (aiRecipeTotalResult.error) {
      throw aiRecipeTotalResult.error;
    }

    const users = usersResult.data.users;
    const userIds = users.map((user) => user.id);
    const savedRecipeCountByUser = new Map<string, number>();
    const extractionCountByUser = new Map<string, number>();
    const nicknameByUser = new Map<string, string>();

    if (userIds.length) {
      const [savedCountResults, usageResult, profilesResult] = await Promise.all([
        Promise.all(
          userIds.map((userId) =>
            supabase
              .from("saved_recipes")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId),
          ),
        ),
        supabase
          .from("usage_records")
          .select("user_id, generation_count")
          .in("user_id", userIds),
        supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", userIds),
      ]);

      savedCountResults.forEach((result, index) => {
        if (result.error) {
          throw result.error;
        }
        savedRecipeCountByUser.set(userIds[index], result.count ?? 0);
      });

      if (usageResult.error) {
        throw usageResult.error;
      }
      if (profilesResult.error) {
        throw profilesResult.error;
      }

      for (const profile of profilesResult.data ?? []) {
        nicknameByUser.set(profile.id, profile.nickname);
      }

      const generatedProfiles = await Promise.all(
        users
          .filter((user) => !nicknameByUser.has(user.id))
          .map((user) => getOrCreateAccountProfile(user)),
      );
      for (const profile of generatedProfiles) {
        nicknameByUser.set(profile.id, profile.nickname);
      }

      for (const usage of usageResult.data ?? []) {
        if (!usage.user_id) {
          continue;
        }
        extractionCountByUser.set(
          usage.user_id,
          (extractionCountByUser.get(usage.user_id) ?? 0) + Number(usage.generation_count ?? 0),
        );
      }
    }

    const totalMembers = usersResult.data.total || users.length;
    const totalPages = Math.max(
      usersResult.data.lastPage || Math.ceil(totalMembers / MEMBERS_PER_PAGE),
      1,
    );

    return Response.json(
      {
        summary: {
          members: totalMembers,
          savedRecipes: savedRecipeTotalResult.count ?? 0,
          aiGeneratedRecipes: aiRecipeTotalResult.count ?? 0,
        },
        members: users.map((user) => ({
          id: user.id,
          nickname: nicknameByUser.get(user.id) ?? "닉네임 생성 중",
          email: user.email ?? "이메일 없음",
          joinedAt: user.created_at,
          lastSignInAt: user.last_sign_in_at ?? null,
          savedRecipeCount: savedRecipeCountByUser.get(user.id) ?? 0,
          extractionCount: extractionCountByUser.get(user.id) ?? 0,
        })),
        pagination: {
          page,
          pageSize: MEMBERS_PER_PAGE,
          totalItems: totalMembers,
          totalPages,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[/api/admin/members] failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "회원 현황을 불러오지 못했습니다.",
      500,
    );
  }
}

function readAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
