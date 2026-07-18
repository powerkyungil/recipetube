export type RecipeIngredient = {
  name: string;
  amount: string | null;
  note: string | null;
};

export type RecipeStep = {
  order: number;
  text: string;
  estimated_time: string | null;
  source_text: string;
  source_time: number | null;
  confidence: number;
};

export type Recipe = {
  title: string;
  servings: string | null;
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
  cook_time: string | null;
  difficulty: "easy" | "medium" | "hard" | "unknown";
  confidence_score: number;
  assumptions: string[];
  warnings: string[];
};

export type ExtractRecipeResponse = {
  recipe: Recipe;
  source: {
    url: string;
    canonicalUrl: string;
    youtubeVideoId: string;
    youtubeTitle: string | null;
    fromCache: boolean;
    isMock?: boolean;
    isDemo?: boolean;
  };
  usage: {
    limit: number;
    used: number;
    remaining: number;
    subject: "anonymous" | "user";
  };
};

export type UsageStatusResponse = {
  authenticated: boolean;
  usage: ExtractRecipeResponse["usage"] | null;
  monthKey: string | null;
};
