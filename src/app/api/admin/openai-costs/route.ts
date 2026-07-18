import { jsonError } from "@/lib/request";
import { getUserFromRequest } from "@/lib/supabase-admin";

type OpenAiCostResult = {
  amount?: {
    value?: number;
    currency?: string;
  };
};

type OpenAiCostBucket = {
  start_time: number;
  end_time: number;
  results?: OpenAiCostResult[];
};

type OpenAiCostsPage = {
  data?: OpenAiCostBucket[];
  has_more?: boolean;
  next_page?: string | null;
  error?: { message?: string };
};

const OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs";

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return jsonError("관리자 로그인이 필요합니다.", 401);
    }

    const allowedEmails = readAdminEmails();
    const email = user.email?.trim().toLowerCase();

    if (!email || !allowedEmails.includes(email)) {
      return jsonError("관리자 권한이 없는 계정입니다.", 403);
    }

    const adminKey = process.env.OPENAI_ADMIN_KEY;
    const creditTotal = Number(process.env.OPENAI_CREDIT_TOTAL_USD);
    const creditGrantedAt = process.env.OPENAI_CREDIT_GRANTED_AT;
    const creditExpiresAt = process.env.OPENAI_CREDIT_EXPIRES_AT;

    if (!adminKey || !Number.isFinite(creditTotal) || !creditGrantedAt || !creditExpiresAt) {
      return jsonError("OpenAI 관리자 비용 설정이 완료되지 않았습니다.", 503);
    }

    const grantStart = Date.parse(`${creditGrantedAt}T00:00:00Z`);

    if (!Number.isFinite(grantStart)) {
      return jsonError("OpenAI 크레딧 지급일 설정이 올바르지 않습니다.", 500);
    }

    const now = new Date();
    const buckets = await fetchAllCostBuckets({
      adminKey,
      startTime: Math.floor(grantStart / 1000),
      endTime: Math.floor(now.getTime() / 1000) + 1,
    });

    const dailyCosts = buckets
      .map((bucket) => ({
        date: new Date(bucket.start_time * 1000).toISOString().slice(0, 10),
        amount: sumBucket(bucket),
      }))
      .filter((item) => item.amount > 0);

    const lifetimeCost = roundUsd(
      buckets.reduce((total, bucket) => total + sumBucket(bucket), 0),
    );
    const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
    const monthCost = roundUsd(
      buckets
        .filter((bucket) => bucket.start_time >= monthStart)
        .reduce((total, bucket) => total + sumBucket(bucket), 0),
    );

    return Response.json(
      {
        credit: {
          total: creditTotal,
          spent: lifetimeCost,
          estimatedRemaining: roundUsd(Math.max(creditTotal - lifetimeCost, 0)),
          grantedAt: creditGrantedAt,
          expiresAt: creditExpiresAt,
          currency: "usd",
        },
        currentMonth: {
          spent: monthCost,
          monthKey: now.toISOString().slice(0, 7),
        },
        dailyCosts: dailyCosts.slice(-30),
        asOf: now.toISOString(),
        billingUrl:
          "https://platform.openai.com/settings/organization/billing/credit-grants",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[/api/admin/openai-costs] failed:", error);
    return jsonError(
      error instanceof Error ? error.message : "OpenAI 비용을 불러오지 못했습니다.",
      502,
    );
  }
}

function readAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function fetchAllCostBuckets(input: {
  adminKey: string;
  startTime: number;
  endTime: number;
}) {
  const buckets: OpenAiCostBucket[] = [];
  let page: string | null = null;

  do {
    const url = new URL(OPENAI_COSTS_URL);
    url.searchParams.set("start_time", `${input.startTime}`);
    url.searchParams.set("end_time", `${input.endTime}`);
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "180");
    if (page) {
      url.searchParams.set("page", page);
    }

    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${input.adminKey}`,
        "content-type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await response.json()) as OpenAiCostsPage;

    if (!response.ok) {
      throw new Error(
        data.error?.message ?? "OpenAI Costs API 요청에 실패했습니다.",
      );
    }

    buckets.push(...(data.data ?? []));
    page = data.has_more ? (data.next_page ?? null) : null;
  } while (page);

  return buckets;
}

function sumBucket(bucket: OpenAiCostBucket) {
  return (bucket.results ?? []).reduce(
    (total, result) => total + Number(result.amount?.value ?? 0),
    0,
  );
}

function roundUsd(value: number) {
  return Math.round((value + Number.EPSILON) * 100_000) / 100_000;
}
