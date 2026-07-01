import { NextResponse } from "next/server";
import { exchangeCodeAndCreateAccount } from "@/lib/youtube";

/**
 * GET /api/youtube/callback?code=...&state=...
 * Google redirects here after the user grants consent. We exchange the
 * code for tokens, fetch the channel info, persist a YouTubeAccount, and
 * redirect back to the return URL (defaults to /settings).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const returnTo = url.searchParams.get("state") || "/settings";

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent(`OAuth denied: ${error}`)}`,
        url.origin,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent("Missing authorization code")}`,
        url.origin,
      ),
    );
  }

  try {
    const account = await exchangeCodeAndCreateAccount(code);
    return NextResponse.redirect(
      new URL(
        `/settings?connected=${encodeURIComponent(account.displayName)}`,
        url.origin,
      ),
    );
  } catch (e: any) {
    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent(e?.message || "OAuth exchange failed")}`,
        url.origin,
      ),
    );
  }
}
