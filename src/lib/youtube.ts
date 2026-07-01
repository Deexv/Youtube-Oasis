/**
 * Real YouTube Data API v3 integration.
 *
 * Uploads the video file via `videos.insert` with:
 *   status.privacyStatus = "private"
 *   status.publishAt    = scheduledTime   (RFC 3339)
 *   status.selfDeclaredMadeForKids = false
 *
 * Auth uses an OAuth2 refresh-token flow — the user provides client_id,
 * client_secret and a long-lived refresh_token in .env. We exchange the
 * refresh token for an access_token on every call (Google access tokens
 * expire after 1 hour; the refresh token is valid indefinitely unless
 * revoked).
 *
 * If YOUTUBE_MOCK_MODE !== "false" we still support a mock path for local
 * development, but the DEFAULT is live mode. Set YOUTUBE_MOCK_MODE=true
 * explicitly to opt into mock.
 *
 * Docs:
 *   https://developers.google.com/youtube/v3/docs/videos/insert
 *   https://developers.google.com/youtube/v3/guides/auth/installed-apps
 */

import { google } from "googleapis";
import { Readable } from "stream";

export {
  youtubeWatchUrl,
  youtubeShortUrl,
  youtubeThumbnail,
} from "@/lib/youtube-shared";

export type YouTubeScheduleInput = {
  title: string;
  description?: string;
  filePath: string;
  scheduledTime: string; // ISO
  thumbnailUrl?: string;
  tags?: string[];
  categoryId?: number; // 22 = People & Blog, 24 = Entertainment, etc.
  isShort?: boolean;
};

export type YouTubeScheduleResult = {
  youtubeId: string;
  scheduledTime: string;
  mock: boolean;
};

export function isMockMode(): boolean {
  const v = process.env.YOUTUBE_MOCK_MODE;
  // Default to LIVE mode (mock must be opted-in explicitly).
  return v === "true";
}

export function isYouTubeConfigured(): boolean {
  return Boolean(
    process.env.YOUTUBE_CLIENT_ID &&
      process.env.YOUTUBE_CLIENT_SECRET &&
      process.env.YOUTUBE_REFRESH_TOKEN,
  );
}

function fakeYoutubeId(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let out = "";
  for (let i = 0; i < 11; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function toRFC3339(iso: string): string {
  // YouTube requires RFC 3339 with explicit timezone. ISO strings from
  // Date.toISOString() are already RFC 3339 (Z suffix).
  return new Date(iso).toISOString();
}

function getOAuth2Client() {
  const clientId = process.env.YOUTUBE_CLIENT_ID!;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET!;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN!;
  // Redirect URI must match the one used to obtain the refresh token.
  // The Google installed-app flow uses "urn:ietf:wg:oauth:2.0:oob" or
  // http://localhost. We use the standard OOB redirect.
  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "urn:ietf:wg:oauth:2.0:oob",
  );
  oauth2.setCredentials({ refresh_token: refreshToken });
  return oauth2;
}

/**
 * Schedule a video on YouTube by uploading the file and setting
 * publishAt to the desired time. The video stays private until the
 * scheduled time, then YouTube flips it to public automatically.
 *
 * In mock mode (YOUTUBE_MOCK_MODE=true) this skips the network call
 * and returns a fake ID for local development.
 */
export async function scheduleOnYouTube(
  input: YouTubeScheduleInput,
): Promise<YouTubeScheduleResult> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 200));
    return {
      youtubeId: fakeYoutubeId(),
      scheduledTime: input.scheduledTime,
      mock: true,
    };
  }

  if (!isYouTubeConfigured()) {
    throw new Error(
      "YouTube is not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, " +
        "YOUTUBE_REFRESH_TOKEN in .env (or set YOUTUBE_MOCK_MODE=true for local dev).",
    );
  }

  const auth = getOAuth2Client();
  const youtube = google.youtube({ version: "v3", auth });

  // Build the video metadata. YouTube requires snippet + status.
  const publishAt = toRFC3339(input.scheduledTime);

  // The filePath may be a local path or a URL. For real uploads we need a
  // readable stream. We support both local files and HTTP(S) URLs.
  const { filePath } = input;
  let bodyStream: Readable;

  if (/^https?:\/\//i.test(filePath)) {
    // Remote URL — fetch as a stream.
    const resp = await fetch(filePath);
    if (!resp.ok || !resp.body) {
      throw new Error(`Failed to fetch video file (${resp.status}): ${filePath}`);
    }
    bodyStream = Readable.fromWeb(resp.body as any);
  } else {
    // Local file — use Node fs. Imported lazily so the mock path never
    // requires fs on the client.
    const fs = await import("fs");
    if (!fs.existsSync(filePath)) {
      throw new Error(`Video file not found: ${filePath}`);
    }
    bodyStream = fs.createReadStream(filePath);
  }

  const insertRes = await youtube.videos.insert(
    {
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: input.title.slice(0, 100),
          description: (input.description ?? "").slice(0, 5000),
          tags: input.tags ?? [],
          categoryId: String(input.categoryId ?? 22),
          defaultLanguage: "en",
          defaultAudioLanguage: "en",
        },
        status: {
          privacyStatus: "private",
          publishAt,
          selfDeclaredMadeForKids: false,
          containsSyntheticMedia: false,
        },
      },
      media: { body: bodyStream },
    },
    // Resumable upload — YouTube supports up to 256GB this way.
    { onUploadProgress: (e: any) => {
      // Optional: hook into progress events for a future progress bar.
    } },
  );

  const videoId = insertRes.data.id;
  if (!videoId) {
    throw new Error("YouTube did not return a video id");
  }

  return {
    youtubeId: videoId,
    scheduledTime: input.scheduledTime,
    mock: false,
  };
}
