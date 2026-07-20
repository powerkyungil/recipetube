import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptTooManyRequestError,
  YoutubeTranscriptVideoUnavailableError,
} from "youtube-transcript";

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

export type YouTubeTranscriptFetchErrorCode =
  | "rate_limited"
  | "video_unavailable"
  | "request_failed";

export class YouTubeTranscriptFetchError extends Error {
  readonly code: YouTubeTranscriptFetchErrorCode;

  constructor(
    code: YouTubeTranscriptFetchErrorCode,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "YouTubeTranscriptFetchError";
    this.code = code;
  }
}

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
  const languages: Array<string | undefined> = ["ko", "en", undefined];

  for (const lang of languages) {
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(
        videoId,
        lang ? { lang } : undefined,
      );

      const text = transcript
        .map((item) => item.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (text.length > 0) {
        return text;
      }
    } catch (error) {
      if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
        continue;
      }

      if (
        error instanceof YoutubeTranscriptDisabledError ||
        error instanceof YoutubeTranscriptNotAvailableError
      ) {
        return null;
      }

      if (error instanceof YoutubeTranscriptTooManyRequestError) {
        throw new YouTubeTranscriptFetchError("rate_limited", {
          cause: error,
        });
      }

      if (error instanceof YoutubeTranscriptVideoUnavailableError) {
        throw new YouTubeTranscriptFetchError("video_unavailable", {
          cause: error,
        });
      }

      throw new YouTubeTranscriptFetchError("request_failed", {
        cause: error,
      });
    }
  }

  return null;
}
