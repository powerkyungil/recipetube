import type { ExtractRecipeResponse, Recipe } from "@/types/recipe";

const MOCK_RECIPE: Recipe = {
  title: "매콤달콤 제육볶음",
  servings: "2인분",
  ingredients: [
    { name: "돼지고기 앞다리살", amount: "400g", note: "먹기 좋은 크기" },
    { name: "양파", amount: "1/2개", note: "채 썰기" },
    { name: "대파", amount: "1/2대", note: "어슷 썰기" },
    { name: "고추장", amount: "2큰술", note: null },
    { name: "고춧가루", amount: "1큰술", note: null },
    { name: "진간장", amount: "1큰술", note: null },
    { name: "올리고당", amount: "1큰술", note: null },
    { name: "다진 마늘", amount: "1큰술", note: null },
  ],
  steps: [
    {
      order: 1,
      text: "고추장, 고춧가루, 진간장, 올리고당, 다진 마늘을 섞어 양념장을 만듭니다.",
      estimated_time: "3분",
      source_text: "양념 재료를 모두 넣고 잘 섞어주세요.",
      source_time: 4,
      confidence: 0.99,
    },
    {
      order: 2,
      text: "돼지고기에 양념장을 넣고 골고루 버무립니다.",
      estimated_time: "5분",
      source_text: "고기에 양념장을 넣고 골고루 버무려주세요.",
      source_time: 11,
      confidence: 0.99,
    },
    {
      order: 3,
      text: "달군 팬에 양념한 돼지고기를 넣고 중불에서 볶습니다.",
      estimated_time: "8분",
      source_text: "달군 팬에 고기를 넣고 중불에서 볶아주세요.",
      source_time: 18,
      confidence: 0.98,
    },
    {
      order: 4,
      text: "고기가 거의 익으면 양파와 대파를 넣고 3분간 더 볶아 완성합니다.",
      estimated_time: "3분",
      source_text: "양파와 대파를 넣고 3분만 더 볶으면 완성입니다.",
      source_time: 31,
      confidence: 0.98,
    },
  ],
  cook_time: "약 20분",
  difficulty: "easy",
  confidence_score: 0.98,
  assumptions: [],
  warnings: ["현재 개발용 Mock 데이터가 표시되고 있으며 실제 영상은 분석하지 않았습니다."],
};

export function createMockRecipeResponse(input: {
  url: string;
  canonicalUrl: string;
  videoId: string;
  usage: ExtractRecipeResponse["usage"];
  isDemo?: boolean;
}): ExtractRecipeResponse {
  return {
    recipe: {
      ...MOCK_RECIPE,
      warnings: input.isDemo
        ? ["비로그인 화면에 표시되는 체험용 예시 레시피입니다."]
        : MOCK_RECIPE.warnings,
    },
    source: {
      url: input.url,
      canonicalUrl: input.canonicalUrl,
      youtubeVideoId: input.videoId,
      youtubeTitle: "레시담 개발용 제육볶음 레시피",
      fromCache: false,
      isMock: true,
      isDemo: input.isDemo,
    },
    usage: input.usage,
  };
}
