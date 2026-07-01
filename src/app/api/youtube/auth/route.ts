import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/youtube";

/**
 * GET /api/youtube/auth
 * Redirects the user to Google's OAuth consent screen. After consent,
 * Google redirects back to /api/youtube/callback with an authorization code.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/settings";
  try {
    const authUrl = await getAuthUrl(returnTo);
    return NextResponse.redirect(authUrl);
  } catch (e: any) {
    return NextResponse.redirect(
      new URL(
        `/settings?error=${encodeURIComponent(e?.message || "OAuth init failed")}`,
        url.origin,
      ),
    );
  }
}
