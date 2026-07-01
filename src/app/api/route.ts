import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isYouTubeConfiguredAsync, isMockMode } from "@/lib/youtube";
import { getConfiguredProviders } from "@/lib/llm";

/**
 * Health check endpoint.
 * GET /api returns { ok, db, youtube, llm } — used by deploy checks
 * and the README quickstart verification.
 */
export async function GET() {
  let dbOk = false;
  try {
    await db.setting.count();
    dbOk = true;
  } catch {
    dbOk = false;
  }

  return NextResponse.json({
    ok: dbOk,
    db: dbOk,
    youtube: await isYouTubeConfiguredAsync(),
    youtubeMockMode: isMockMode(),
    llm: { configured: getConfiguredProviders() },
    timestamp: new Date().toISOString(),
  });
}
