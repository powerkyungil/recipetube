export type RecipeIngredient = {
  name: string;
  amount: string | null;
  note: string | null;
};

export type RecipeStep = {
  order: number;
  text: string;
  estimated_time: string | null;
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
  };
  usage: {
    limit: number;
    used: number;
    remaining: number;
    subject: "anonymous" | "user";
  };
};
