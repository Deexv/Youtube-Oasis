import { NextResponse } from "next/server";
import {
  getYouTubeOAuthSettings,
  saveYouTubeOAuthSettings,
  deleteYouTubeOAuthSettings,
} from "@/lib/youtube-oauth-settings";
import { isMockMode } from "@/lib/youtube";

/**
 * GET /api/youtube/oauth-config
 * Returns whether OAuth is configured + the redirect URI (for the setup wizard).
 * Never returns the client secret.
 */
export async function GET() {
  const settings = await getYouTubeOAuthSettings();
  return NextResponse.json({
    configured: settings !== null,
    redirectUri: settings?.redirectUri || `${new URL("/api/youtube/callback", "http://localhost:3000").href}`,
    // Build the redirect URI from the request if no settings yet
    mockMode: isMockMode(),
    source: settings ? "db-or-env" : "none",
  });
}

/**
 * POST /api/youtube/oauth-config
 * Save OAuth credentials (from the in-app setup wizard).
 * Body: { clientId, clientSecret, redirectUri? }
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { clientId, clientSecret, redirectUri } = body || {};

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "clientId and clientSecret are required" },
      { status: 400 },
    );
  }

  // Build the redirect URI from the request origin if not provided
  const url = new URL(req.url);
  const finalRedirectUri =
    redirectUri || `${url.origin}/api/youtube/callback`;

  await saveYouTubeOAuthSettings({
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    redirectUri: finalRedirectUri,
  });

  return NextResponse.json({ ok: true, redirectUri: finalRedirectUri });
}

/**
 * DELETE /api/youtube/oauth-config
 * Remove DB-stored OAuth credentials (revert to env-only mode).
 */
export async function DELETE() {
  await deleteYouTubeOAuthSettings();
  return NextResponse.json({ ok: true });
}
