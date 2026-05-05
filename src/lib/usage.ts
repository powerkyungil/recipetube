import type { SupabaseClient } from "@supabase/supabase-js";

export const ANONYMOUS_MONTHLY_LIMIT = 2;
export const USER_MONTHLY_LIMIT = 5;
export const SAVED_RECIPE_LIMIT = 5;

export function getKstMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

export function getUsageLimit(userId: string | null) {
  return userId ? USER_MONTHLY_LIMIT : ANONYMOUS_MONTHLY_LIMIT;
}

export async function readUsage(
  supabase: SupabaseClient,
  subject: { userId: string | null; anonymousId: string | null },
) {
  const monthKey = getKstMonthKey();
  const limit = getUsageLimit(subject.userId);
  const query = supabase
    .from("usage_records")
    .select("id, generation_count")
    .eq("month_key", monthKey)
    .limit(1);

  const scopedQuery = subject.userId
    ? query.eq("user_id", subject.userId)
    : query.eq("anonymous_id", subject.anonymousId);

  const { data, error } = await scopedQuery.maybeSingle();

  if (error) {
    throw error;
  }

  const used = data?.generation_count ?? 0;

  return {
    recordId: data?.id ?? null,
    monthKey,
    limit,
    used,
    remaining: Math.max(limit - used, 0),
  };
}

export async function incrementUsage(
  supabase: SupabaseClient,
  subject: { userId: string | null; anonymousId: string | null },
) {
  const usage = await readUsage(supabase, subject);

  if (usage.used >= usage.limit) {
    return { ...usage, allowed: false };
  }

  const nextCount = usage.used + 1;

  if (usage.recordId) {
    const { error } = await supabase
      .from("usage_records")
      .update({
        generation_count: nextCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", usage.recordId);

    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("usage_records").insert({
      user_id: subject.userId,
      anonymous_id: subject.userId ? null : subject.anonymousId,
      month_key: usage.monthKey,
      generation_count: nextCount,
    });

    if (error) {
      throw error;
    }
  }

  return {
    ...usage,
    allowed: true,
    used: nextCount,
    remaining: Math.max(usage.limit - nextCount, 0),
  };
}
