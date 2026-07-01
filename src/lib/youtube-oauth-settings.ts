/**
 * Stores the Google OAuth client credentials (client ID + secret) in the DB
 * so users can configure them from the Settings UI without editing .env.
 *
 * The credentials are read in this priority order:
 *   1. DB (Setting row with key "youtube_oauth") — set via the in-app wizard
 *   2. process.env (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET) — for .env users
 *
 * This lets the app work two ways:
 *   - Self-hosted users who want the wizard → paste creds in Settings, done.
 *   - Power users / CI → set env vars, never touch the UI.
 */

import { db } from "@/lib/db";

export type YouTubeOAuthSettings = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const SETTING_KEY = "youtube_oauth";
const DEFAULT_REDIRECT_URI =
  typeof window !== "undefined"
    ? `${window.location.origin}/api/youtube/callback`
    : "http://localhost:3000/api/youtube/callback";

/**
 * Get the OAuth credentials from DB first, then env.
 * Returns null if not configured anywhere.
 */
export async function getYouTubeOAuthSettings(): Promise<YouTubeOAuthSettings | null> {
  // Try DB first
  const row = await db.setting.findUnique({ where: { key: SETTING_KEY } });
  if (row) {
    try {
      const parsed = JSON.parse(row.value) as Partial<YouTubeOAuthSettings>;
      if (parsed.clientId && parsed.clientSecret) {
        return {
          clientId: parsed.clientId,
          clientSecret: parsed.clientSecret,
          redirectUri: parsed.redirectUri || DEFAULT_REDIRECT_URI,
        };
      }
    } catch {
      // fall through to env
    }
  }

  // Fall back to env
  if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) {
    return {
      clientId: process.env.YOUTUBE_CLIENT_ID,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
      redirectUri: process.env.YOUTUBE_REDIRECT_URI || DEFAULT_REDIRECT_URI,
    };
  }

  return null;
}

/**
 * Save OAuth credentials to the DB (upsert).
 */
export async function saveYouTubeOAuthSettings(settings: YouTubeOAuthSettings): Promise<void> {
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(settings) },
    create: { key: SETTING_KEY, value: JSON.stringify(settings) },
  });
}

/**
 * Delete OAuth credentials from the DB (revert to env-only mode).
 */
export async function deleteYouTubeOAuthSettings(): Promise<void> {
  await db.setting.deleteMany({ where: { key: SETTING_KEY } });
}

/**
 * Check if OAuth is configured (either DB or env).
 */
export async function isYouTubeOAuthConfigured(): Promise<boolean> {
  return (await getYouTubeOAuthSettings()) !== null;
}
