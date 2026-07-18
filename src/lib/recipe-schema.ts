import { z } from "zod";

const nullableShortText = z.string().trim().max(120).nullable();

export const editableRecipeSchema = z.object({
  title: z.string().trim().min(1).max(120),
  servings: nullableShortText,
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        amount: nullableShortText,
        note: z.string().trim().max(240).nullable(),
      }),
    )
    .min(1)
    .max(50),
  steps: z
    .array(
      z.object({
        order: z.number().int().positive(),
        text: z.string().trim().min(1).max(1000),
        estimated_time: nullableShortText,
        source_text: z.string().max(2000),
        source_time: z.number().nonnegative().nullable(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .min(1)
    .max(50),
  cook_time: nullableShortText,
  difficulty: z.enum(["easy", "medium", "hard", "unknown"]),
  confidence_score: z.number().min(0).max(1),
  assumptions: z.array(z.string().max(500)).max(30),
  warnings: z.array(z.string().max(500)).max(30),
});

export const recipeMutationBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  recipe: editableRecipeSchema,
});
