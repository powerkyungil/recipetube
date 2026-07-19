import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type AccountProfile = {
  id: string;
  nickname: string;
  email: string;
};

const adjectives = [
  "고소한", "달콤한", "든든한", "따뜻한", "바삭한", "상큼한", "싱그러운", "포근한",
  "말랑한", "보들보들한", "산뜻한", "소담한", "정겨운", "느긋한", "다정한", "튼튼한",
  "행복한", "기분좋은", "반짝이는", "향긋한", "담백한", "쫄깃한", "알찬", "정갈한",
  "푸릇한", "건강한", "편안한", "신선한", "느린", "즐거운", "부드러운", "화사한",
  "맑은", "소중한", "풍성한", "야무진", "귀여운", "새콤한", "정성스런", "포슬한",
];

const nouns = [
  "냉장고", "국자", "앞치마", "접시", "주걱", "바질", "만두", "토마토",
  "김치찌개", "라면", "밥그릇", "도마", "후라이팬", "숟가락", "찜기", "오븐",
  "주방", "반찬", "레시피", "식탁", "파스타", "감자", "버섯", "계란",
  "딸기", "레몬", "복숭아", "호박", "고구마", "만찬", "샐러드", "쿠키",
  "국물", "볶음밥", "빵바구니", "찻잔", "커피콩", "김밥", "피클", "수프",
];

export const nicknamePattern = /^[가-힣a-zA-Z0-9]{2,16}$/;

export function normalizeNickname(value: string) {
  return value.trim();
}

export function isValidNickname(value: string) {
  return nicknamePattern.test(value);
}

export function generateNickname() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 900) + 100;
  return `${adjective}${noun}${number}`;
}

export async function getOrCreateAccountProfile(user: {
  id: string;
  email?: string | null;
}): Promise<AccountProfile> {
  const supabase = getSupabaseAdmin();
  const email = user.email ?? "";
  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("id, nickname")
    .eq("id", user.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return { ...existing, email };
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: user.id, nickname: generateNickname() })
      .select("id, nickname")
      .single();

    if (!error && data) {
      return { ...data, email };
    }

    if (error?.code !== "23505") {
      throw error;
    }

    const { data: concurrentProfile, error: concurrentError } = await supabase
      .from("profiles")
      .select("id, nickname")
      .eq("id", user.id)
      .maybeSingle();

    if (concurrentError) {
      throw concurrentError;
    }

    if (concurrentProfile) {
      return { ...concurrentProfile, email };
    }
  }

  throw new Error("닉네임을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}
