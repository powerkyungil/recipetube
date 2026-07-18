import { YoutubeTranscript } from "youtube-transcript";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ytdl from "@distube/ytdl-core";

export type ParsedShortsUrl =
  | {
      ok: true;
      videoId: string;
      canonicalUrl: string;
    }
  | {
      ok: false;
      reason: string;
    };

const YOUTUBE_SHORTS_PATH = /^\/shorts\/([a-zA-Z0-9_-]{11})\/?$/;

export function parseYouTubeShortsUrl(input: string): ParsedShortsUrl {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "올바른 URL이 아닙니다." };
  }

  const hostname = url.hostname.replace(/^www\./, "");
  const isYouTube = hostname === "youtube.com" || hostname === "m.youtube.com";

  if (!isYouTube) {
    return { ok: false, reason: "YouTube Shorts 링크만 사용할 수 있습니다." };
  }

  const match = url.pathname.match(YOUTUBE_SHORTS_PATH);

  if (!match) {
    return {
      ok: false,
      reason: "일반 YouTube 영상은 지원하지 않습니다. Shorts 링크만 입력해주세요.",
    };
  }

  return {
    ok: true,
    videoId: match[1],
    canonicalUrl: `https://www.youtube.com/shorts/${match[1]}`,
  };
}

export async function fetchYouTubeTitle(videoId: string) {
  const response = await fetch(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/shorts/${videoId}&format=json`,
    { next: { revalidate: 60 * 60 * 24 } },
  );

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { title?: string };
  return data.title ?? null;
}

export async function fetchYouTubeTranscript(videoId: string) {
  const languages = ["ko", "en"];

  for (const lang of languages) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
        lang,
      });

      const text = transcript
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (text.length > 0) {
        return text;
      }
    } catch {
      // Try the next language before failing.
    }
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript
      .map((item) => item.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return null;
  }
}

export async function downloadYouTubeShortsAudio(videoId: string) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "recipetube-"));
  const filePath = path.join(tempDir, `${videoId}.webm`);
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const info = await ytdl.getInfo(url);
    const lengthSeconds = Number(info.videoDetails.lengthSeconds || "0");

    if (lengthSeconds > 180) {
      throw new Error("전사 대상 영상 길이가 너무 깁니다. 3분 이하 영상만 지원합니다.");
    }

    await new Promise<void>((resolve, reject) => {
      const audioFormats = info.formats
        .filter((format) => format.hasAudio)
        .sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));

      if (audioFormats.length === 0) {
        reject(new Error("Failed to find any playable formats"));
        return;
      }

      const stream = ytdl.downloadFromInfo(info, {
        format: audioFormats[0],
      });
      const file = createWriteStream(filePath);

      stream.on("error", reject);
      file.on("error", reject);
      file.on("finish", () => resolve());

      stream.pipe(file);
    });

    return {
      filePath,
      cleanup: async () => {
        await rm(tempDir, { recursive: true, force: true });
      },
    };
  } catch {
    try {
      const ytDlpPath = await downloadWithYtDlp(url, tempDir, videoId);
      return {
        filePath: ytDlpPath,
        cleanup: async () => {
          await rm(tempDir, { recursive: true, force: true });
        },
      };
    } catch (fallbackError) {
      await rm(tempDir, { recursive: true, force: true });
      throw fallbackError;
    }
  }
}

export async function extractOcrTextFromShorts(videoId: string) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "recipetube-ocr-"));
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const videoPath = path.join(tempDir, `${videoId}.mp4`);
  const framesDir = path.join(tempDir, "frames");

  try {
    await runCommand("yt-dlp", [
      "--no-playlist",
      "-f",
      "mp4/best",
      "-o",
      videoPath,
      url,
    ]);

    await mkdir(framesDir, { recursive: true });
    await runCommand("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-vf",
      [
        "fps=2",
        "scale=1080:-1:flags=lanczos",
        "crop=iw:ih*0.45:0:ih*0.5",
        "eq=contrast=1.35:brightness=0.04:saturation=0",
        "unsharp=5:5:1.0:5:5:0.0",
      ].join(","),
      "-frames:v",
      "60",
      path.join(framesDir, "frame-%03d.jpg"),
    ]);

    const files = (await readdir(framesDir))
      .filter((name) => name.endsWith(".jpg"))
      .sort();

    const frameTexts: string[] = [];
    for (const file of files) {
      const framePath = path.join(framesDir, file);
      const text = await runTesseract(framePath);
      if (text) {
        frameTexts.push(text);
      }
    }

    const mergedByVotes = mergeOcrLinesByVotes(frameTexts);
    const merged = normalizeOcrText(mergedByVotes);
    const refined = refineRecipeOcrText(merged);
    return refined.length > 0 ? refined : null;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function downloadWithYtDlp(
  url: string,
  outputDir: string,
  videoId: string,
) {
  const outputTemplate = path.join(outputDir, `${videoId}.%(ext)s`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("yt-dlp", [
      "--no-playlist",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
      "-o",
      outputTemplate,
      url,
    ]);

    let stderr = "";

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(
        new Error(
          `yt-dlp 실행 실패: ${error.message}. yt-dlp 설치 후 다시 시도해주세요.`,
        ),
      );
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`yt-dlp 다운로드 실패: ${stderr.trim() || `exit ${code}`}`));
    });
  });

  const files = await readdir(outputDir);
  const matched = files.find((name) => name.startsWith(`${videoId}.`));

  if (!matched) {
    throw new Error("yt-dlp 다운로드는 완료됐지만 오디오 파일을 찾지 못했습니다.");
  }

  return path.join(outputDir, matched);
}

async function runTesseract(imagePath: string) {
  try {
    const korEng = await runCommand("tesseract", [
      imagePath,
      "stdout",
      "-l",
      "kor+eng",
      "--oem",
      "1",
      "--psm",
      "6",
      "-c",
      "preserve_interword_spaces=1",
    ]);
    return korEng.trim();
  } catch {
    try {
      const engOnly = await runCommand("tesseract", [
        imagePath,
        "stdout",
        "-l",
        "eng",
        "--oem",
        "1",
        "--psm",
        "6",
        "-c",
        "preserve_interword_spaces=1",
      ]);
      return engOnly.trim();
    } catch {
      return "";
    }
  }
}

function normalizeOcrText(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 3)
    .filter((line) => {
      const allowed = line.match(/[가-힣a-zA-Z0-9/%.,()\-+:]/g)?.length ?? 0;
      return allowed / line.length >= 0.6;
    });

  const deduped = [...new Set(lines)];
  return deduped.join("\n").trim();
}

function refineRecipeOcrText(text: string) {
  const rawLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const scored = rawLines
    .map((line) => ({ line: recoverCookingVerbs(line), score: scoreRecipeLine(line) }))
    .filter((item) => item.score >= 3)
    .sort((a, b) => b.score - a.score);

  const picked: string[] = [];
  for (const item of scored) {
    if (picked.length >= 80) {
      break;
    }
    const normalized = canonicalizeLine(item.line);
    const isNearDuplicate = picked.some((existing) => {
      const a = canonicalizeLine(existing);
      return a === normalized || a.includes(normalized) || normalized.includes(a);
    });
    if (!isNearDuplicate) {
      picked.push(item.line);
    }
  }

  return picked.join("\n").trim();
}

function mergeOcrLinesByVotes(frameTexts: string[]) {
  const votes = new Map<string, { raw: string; count: number }>();

  for (const frameText of frameTexts) {
    const lines = frameText
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length >= 3);

    for (const line of lines) {
      const key = canonicalizeLine(line);
      if (key.length < 3) {
        continue;
      }
      const current = votes.get(key);
      if (current) {
        current.count += 1;
      } else {
        votes.set(key, { raw: line, count: 1 });
      }
    }
  }

  const selected = [...votes.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 140)
    .map((item) => item.raw);

  if (selected.length > 0) {
    return selected.join("\n");
  }

  return frameTexts.join("\n");
}

function scoreRecipeLine(line: string) {
  let score = 0;

  if (/[가-힣]{2,}/.test(line)) {
    score += 1;
  }

  if (/(스푼|큰술|작은술|국자|컵|ml|l|모|포기|대|g|kg|분)/i.test(line)) {
    score += 2;
  }

  if (/\d+\s*(\/\s*\d+)?/.test(line)) {
    score += 1;
  }

  if (
    /(넣|볶|끓|썰|자르|예열|마무리|포인트|완성|간장|고추가루|고춧가루|김치|대파|양파|마늘|돼지|두부)/.test(
      line,
    )
  ) {
    score += 2;
  }

  if (/(넣고|넣어|볶아|볶고|끓여|끓이고|썰어|자르고|예열|마무리|완성)/.test(line)) {
    score += 3;
  }

  if (/(스푼|큰술|작은술|국자|컵|ml|l|모|포기|대|g|kg)/i.test(line) && !/(넣|볶|끓|썰|자르|예열|마무리|완성)/.test(line)) {
    score -= 1;
  }

  if (/^[^가-힣a-zA-Z0-9]{0,3}$/.test(line)) {
    score -= 3;
  }

  if (line.length > 80) {
    score -= 1;
  }

  return score;
}

function recoverCookingVerbs(line: string) {
  const tokens = line.split(/\s+/).filter(Boolean);
  const verbs = [
    "넣고",
    "넣어",
    "볶고",
    "볶아",
    "끓여",
    "끓이고",
    "썰고",
    "자르고",
    "예열",
    "마무리",
    "완성",
  ];

  const recovered = tokens.map((token) => {
    const normalized = token.replace(/[^가-힣a-zA-Z0-9]/g, "");
    if (!normalized) {
      return token;
    }
    let best = token;
    let bestDistance = Infinity;
    for (const verb of verbs) {
      const distance = editDistance(normalized, verb);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = verb;
      }
    }
    return bestDistance <= 1 ? best : token;
  });

  return recovered.join(" ");
}

function editDistance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function canonicalizeLine(line: string) {
  return line
    .toLowerCase()
    .replace(/[^가-힣a-z0-9]/g, "")
    .trim();
}

async function runCommand(command: string, args: string[]) {
  return await new Promise<string>((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (error) => {
      reject(new Error(`${command} 실행 실패: ${error.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} 실행 실패: ${stderr.trim() || `exit ${code}`}`));
    });
  });
}
