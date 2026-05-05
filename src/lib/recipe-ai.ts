import OpenAI from "openai";
import type { Recipe } from "@/types/recipe";

const recipeJsonSchema = {
  name: "youtube_shorts_recipe",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "title",
      "servings",
      "ingredients",
      "steps",
      "cook_time",
      "difficulty",
      "confidence_score",
      "assumptions",
      "warnings",
    ],
    properties: {
      title: { type: "string" },
      servings: { type: ["string", "null"] },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "amount", "note"],
          properties: {
            name: { type: "string" },
            amount: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
          },
        },
      },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["order", "text", "estimated_time"],
          properties: {
            order: { type: "number" },
            text: { type: "string" },
            estimated_time: { type: ["string", "null"] },
          },
        },
      },
      cook_time: { type: ["string", "null"] },
      difficulty: {
        type: "string",
        enum: ["easy", "medium", "hard", "unknown"],
      },
      confidence_score: { type: "number", minimum: 0, maximum: 1 },
      assumptions: { type: "array", items: { type: "string" } },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
  strict: true,
} as const;

export async function generateRecipeFromTranscript(input: {
  youtubeTitle: string | null;
  transcript: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content:
          "You extract practical Korean cooking recipes from YouTube Shorts transcripts. Do not invent exact measurements when missing; mark them as null and explain assumptions.",
      },
      {
        role: "user",
        content: [
          `영상 제목: ${input.youtubeTitle ?? "알 수 없음"}`,
          "아래 자막을 한국어 레시피 JSON으로 정리하세요.",
          "영상에 없는 계량은 추정하지 말고 assumptions 또는 warnings에 남기세요.",
          "",
          input.transcript,
        ].join("\n"),
      },
    ],
    text: {
      format: {
        type: "json_schema",
        ...recipeJsonSchema,
      },
    },
  });

  const text = response.output_text;

  if (!text) {
    throw new Error("AI가 레시피 결과를 반환하지 않았습니다.");
  }

  return JSON.parse(text) as Recipe;
}
