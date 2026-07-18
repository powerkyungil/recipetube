import OpenAI from "openai";
import fs from "node:fs";
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
          required: [
            "order",
            "text",
            "estimated_time",
            "source_text",
            "source_time",
            "confidence",
          ],
          properties: {
            order: { type: "number" },
            text: { type: "string" },
            estimated_time: { type: ["string", "null"] },
            source_text: { type: "string" },
            source_time: { type: ["number", "null"] },
            confidence: { type: "number", minimum: 0, maximum: 1 },
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
          [
            "You extract practical Korean cooking recipes from YouTube Shorts transcripts.",
            "Never invent measurements or steps.",
            "For each step, only use text explicitly present in the input transcript.",
            "Preserve the source order from transcript; do not reorder semantically.",
            "If uncertain, lower confidence and add warnings instead of guessing.",
            "Use a two-pass process internally: (1) extract action steps in order, (2) attach ingredients/amounts to each action.",
          ].join(" "),
      },
      {
        role: "user",
        content: [
          `영상 제목: ${input.youtubeTitle ?? "알 수 없음"}`,
          "아래 자막을 한국어 레시피 JSON으로 정리하세요.",
          "중요 규칙:",
          "1) 단계(step)는 입력 텍스트에 실제로 등장한 문구만 사용하세요.",
          "2) 단계별 source_text는 근거가 된 원문 일부를 반드시 넣으세요.",
          "3) source_time은 알 수 없으면 null로 두세요.",
          "4) 근거 없는 단계는 생성하지 마세요.",
          "5) 영상에 없는 계량은 추정하지 말고 assumptions 또는 warnings에 남기세요.",
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

  return sanitizeRecipe(JSON.parse(text) as Recipe, input.transcript);
}

export async function transcribeAudioFile(input: {
  filePath: string;
  language?: string;
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const transcription = await client.audio.transcriptions.create({
    file: fs.createReadStream(input.filePath),
    model: "gpt-4o-mini-transcribe",
    language: input.language ?? "ko",
    response_format: "text",
  });

  return `${transcription}`.trim();
}

function sanitizeRecipe(recipe: Recipe, transcript: string): Recipe {
  const baseSteps = recipe.steps
    .filter((step) => step.text.trim().length > 0)
    .filter((step) => step.source_text.trim().length > 0)
    .filter((step) => step.confidence >= 0 && step.confidence <= 1);

  const actionSteps = baseSteps.filter((step) => hasCookingAction(step.text));
  const filteredSteps = actionSteps.length >= 2 ? actionSteps : baseSteps;

  const ordered = [...filteredSteps].sort((a, b) => {
    if (a.source_time === null && b.source_time === null) {
      return a.order - b.order;
    }
    if (a.source_time === null) {
      return 1;
    }
    if (b.source_time === null) {
      return -1;
    }
    return a.source_time - b.source_time;
  });

  const renumbered = ordered.map((step, index) => ({
    ...step,
    order: index + 1,
  }));

  const transcriptActionSteps = buildActionStepsFromTranscript(transcript);
  const shouldReplaceWithTranscriptSteps =
    actionSteps.length < 2 && transcriptActionSteps.length >= 2;
  const finalSteps = shouldReplaceWithTranscriptSteps
    ? transcriptActionSteps
    : renumbered;

  return {
    ...recipe,
    steps: finalSteps,
    warnings: [
      ...recipe.warnings,
      ...(filteredSteps.length !== recipe.steps.length
        ? ["근거(source_text)가 없는 단계는 자동 제외했습니다."]
        : []),
      ...(actionSteps.length < 2
        ? ["조리 동사 단계가 부족해 근거 기반 단계를 보수적으로 표시했습니다."]
        : []),
      ...(shouldReplaceWithTranscriptSteps
        ? ["모델 단계가 재료 나열 위주여서 transcript의 동사 기반 단계로 보정했습니다."]
        : []),
    ],
  };
}

function hasCookingAction(text: string) {
  return /(넣|볶|끓|썰|자르|예열|마무리|완성|조리|버무리|졸이)/.test(text);
}

function buildActionStepsFromTranscript(transcript: string): Recipe["steps"] {
  const segments = transcript
    .split(/\n|[.!?]/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4);

  const actionLines = segments.filter((line) => hasCookingAction(line));
  const uniqueActionLines = dedupeNearLines(actionLines).slice(0, 12);

  return uniqueActionLines.map((line, index) => ({
    order: index + 1,
    text: line,
    estimated_time: null,
    source_text: line,
    source_time: null,
    confidence: 0.55,
  }));
}

function dedupeNearLines(lines: string[]) {
  const kept: string[] = [];
  for (const line of lines) {
    const key = normalizeLine(line);
    const duplicate = kept.some((item) => {
      const itemKey = normalizeLine(item);
      return itemKey === key || itemKey.includes(key) || key.includes(itemKey);
    });
    if (!duplicate) {
      kept.push(line);
    }
  }
  return kept;
}

function normalizeLine(line: string) {
  return line.toLowerCase().replace(/[^가-힣a-z0-9]/g, "");
}
