import { YoutubeTranscript } from "youtube-transcript";

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
