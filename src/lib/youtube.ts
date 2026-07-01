/**
 * Real YouTube Data API v3 integration with multi-account support.
 *
 * Each YouTubeAccount in the DB holds its own OAuth refresh token. When
 * scheduling a video, the caller passes an `accountId` — we look up the
 * account, build an OAuth2 client with its tokens, and upload via
 * `videos.insert` with `status.publishAt`.
 *
 * The "Add account" flow lives in /api/youtube/auth and
 * /api/youtube/callback — it does the OAuth dance and stores the refresh
 * token + channel info automatically.
 */

// googleapis is imported dynamically inside functions to avoid loading
// the heavy SDK at module evaluation time (saves ~300MB memory).
import { Readable } from "stream";
import { db } from "@/lib/db";
import {
  getYouTubeOAuthSettings,
  type YouTubeOAuthSettings,
} from "@/lib/youtube-oauth-settings";

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
  categoryId?: number;
  isShort?: boolean;
  /** If omitted, uses the default account. */
  accountId?: string | null;
};

export type YouTubeScheduleResult = {
  youtubeId: string;
  scheduledTime: string;
  mock: boolean;
  accountId?: string;
};

export function isMockMode(): boolean {
  const v = process.env.YOUTUBE_MOCK_MODE;
  return v === "true";
}

/**
 * Synchronous check — only checks env vars. Used by the status API for a
 * quick response. For the full check (including DB-stored credentials),
 * use `isYouTubeConfiguredAsync()`.
 */
export function isYouTubeConfigured(): boolean {
  return Boolean(
    process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET,
  );
}

/**
 * Async check — checks both env vars AND DB-stored credentials (set via
 * the in-app setup wizard). This is the authoritative check.
 */
export async function isYouTubeConfiguredAsync(): Promise<boolean> {
  return (await getYouTubeOAuthSettings()) !== null;
}

/**
 * Sync getter for the redirect URI. Uses env or the default. For the
 * DB-stored redirect URI, use `getYouTubeOAuthSettings()` directly.
 */
export function getRedirectUri(): string {
  return (
    process.env.YOUTUBE_REDIRECT_URI ||
    "http://localhost:3000/api/youtube/callback"
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
  return new Date(iso).toISOString();
}

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
];

/**
 * Build the Google OAuth URL for adding a new YouTube account.
 * The user visits this URL, grants consent, and Google redirects back
 * to /api/youtube/callback with an authorization code.
 */
export async function getAuthUrl(state?: string): Promise<string> {
  const settings = await getYouTubeOAuthSettings();
  if (!settings) {
    throw new Error(
      "YouTube OAuth is not configured. Either set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env, or use the in-app setup wizard in Settings → YouTube accounts.",
    );
  }
  const { google } = await import("googleapis");
  const oauth2 = new google.auth.OAuth2(
    settings.clientId,
    settings.clientSecret,
    settings.redirectUri,
  );
  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // forces a new refresh_token each time
    state,
  });
}

/**
 * Exchange the authorization code (from the OAuth callback) for tokens,
 * then fetch the user's YouTube channel info and persist a new
 * YouTubeAccount row. Returns the new account.
 */
export async function exchangeCodeAndCreateAccount(code: string) {
  const settings = await getYouTubeOAuthSettings();
  if (!settings) {
    throw new Error("YouTube OAuth is not configured.");
  }
  const { google } = await import("googleapis");
  const oauth2 = new google.auth.OAuth2(
    settings.clientId,
    settings.clientSecret,
    settings.redirectUri,
  );
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke access at https://myaccount.google.com/permissions and try again, or use prompt:consent.",
    );
  }
  oauth2.setCredentials(tokens);

  // Fetch the channel info
  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const channelRes = await youtube.channels.list({
    part: ["snippet", "contentDetails"],
    mine: true,
  });
  const channel = channelRes.data.items?.[0];
  if (!channel) {
    throw new Error(
      "No YouTube channel found for this Google account. Create a channel at https://youtube.com first.",
    );
  }

  const displayName = channel.snippet?.title || "Unknown channel";
  const channelId = channel.id || undefined;
  const avatarUrl = channel.snippet?.thumbnails?.default?.url || undefined;

  // Check if account already exists — if so, update tokens
  const existing = channelId
    ? await db.youTubeAccount.findUnique({ where: { channelId } })
    : null;

  // Pick a color for the account selector (prevents cross-account mistakes)
  const palette = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
  ];
  const accountCount = await db.youTubeAccount.count();
  const color = existing?.color || palette[accountCount % palette.length];

  if (existing) {
    return db.youTubeAccount.update({
      where: { id: existing.id },
      data: {
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        tokenExpiresAt: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
        displayName,
        avatarUrl,
      },
    });
  }

  // If this is the first account, make it the default
  const isFirst = accountCount === 0;

  return db.youTubeAccount.create({
    data: {
      displayName,
      channelId,
      avatarUrl,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      tokenExpiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
      color,
      isDefault: isFirst,
    },
  });
}

/**
 * Get the default account (or the first one if no default is set).
 */
export async function getDefaultAccount() {
  return (
    (await db.youTubeAccount.findFirst({
      where: { isDefault: true },
    })) ||
    (await db.youTubeAccount.findFirst({
      orderBy: { createdAt: "asc" },
    }))
  );
}

/**
 * Get the OAuth2 client for a specific account. Refreshes the access
 * token automatically if it's expired.
 */
async function getOAuth2ClientForAccount(accountId: string) {
  const account = await db.youTubeAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) {
    throw new Error(`YouTube account not found: ${accountId}`);
  }

  const settings = await getYouTubeOAuthSettings();
  if (!settings) {
    throw new Error(
      "YouTube OAuth is not configured. Use the in-app setup wizard in Settings, or set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env.",
    );
  }
  const { google } = await import("googleapis");
  const oauth2 = new google.auth.OAuth2(
    settings.clientId,
    settings.clientSecret,
    settings.redirectUri,
  );
  oauth2.setCredentials({
    refresh_token: account.refreshToken,
    access_token: account.accessToken || undefined,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  // googleapis auto-refreshes when the access token is expired, but it
  // doesn't persist the new token. We hook the 'tokens' event to save it.
  oauth2.on("tokens", async (tokens) => {
    if (tokens.refresh_token || tokens.access_token) {
      await db.youTubeAccount.update({
        where: { id: account.id },
        data: {
          accessToken: tokens.access_token ?? account.accessToken,
          refreshToken: tokens.refresh_token ?? account.refreshToken,
          tokenExpiresAt: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : account.tokenExpiresAt,
        },
      });
    }
  });

  return { oauth2, account };
}

/**
 * Schedule a video on YouTube by uploading the file and setting
 * publishAt to the desired time.
 *
 * If `accountId` is provided, uses that account's OAuth tokens. Otherwise
 * uses the default account. In mock mode, returns a fake ID.
 */
export async function scheduleOnYouTube(
  input: YouTubeScheduleInput,
): Promise<YouTubeScheduleResult> {
  if (isMockMode()) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      youtubeId: fakeYoutubeId(),
      scheduledTime: input.scheduledTime,
      mock: true,
      accountId: input.accountId ?? undefined,
    };
  }

  if (!(await isYouTubeConfiguredAsync())) {
    throw new Error(
      "YouTube OAuth is not configured. Use the in-app setup wizard in Settings, or set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env. See docs/youtube-oauth.md.",
    );
  }

  // Resolve the account
  let accountId = input.accountId;
  if (!accountId) {
    const def = await getDefaultAccount();
    if (!def) {
      throw new Error(
        "No YouTube account connected. Go to Settings → YouTube Accounts → Add account.",
      );
    }
    accountId = def.id;
  }

  const { oauth2, account } = await getOAuth2ClientForAccount(accountId);
  const { google } = await import("googleapis");
  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const publishAt = toRFC3339(input.scheduledTime);

  const { filePath } = input;
  let bodyStream: Readable;

  if (/^https?:\/\//i.test(filePath)) {
    const resp = await fetch(filePath);
    if (!resp.ok || !resp.body) {
      throw new Error(`Failed to fetch video file (${resp.status}): ${filePath}`);
    }
    bodyStream = Readable.fromWeb(resp.body as ReadableStream<Uint8Array>);
  } else {
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
  );

  const videoId = insertRes.data.id;
  if (!videoId) {
    throw new Error("YouTube did not return a video id");
  }

  return {
    youtubeId: videoId,
    scheduledTime: input.scheduledTime,
    mock: false,
    accountId: account.id,
  };
}

/**
 * List all connected YouTube accounts (for the account selector UI).
 */
export async function listAccounts() {
  return db.youTubeAccount.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      displayName: true,
      channelId: true,
      avatarUrl: true,
      color: true,
      isDefault: true,
      createdAt: true,
    },
  });
}
