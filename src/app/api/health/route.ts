import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { existsSync } from "fs";
import path from "path";

/**
 * GET /api/health
 * Startup health check — verifies the database is initialized and accessible.
 * Returns clear instructions if something is wrong.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; message: string; fix?: string }> = {};

  // 1. Check DATABASE_URL is set
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    checks.database = {
      ok: false,
      message: "DATABASE_URL is not set in .env",
      fix: "Copy .env.example to .env and run: npm run db:push",
    };
    return NextResponse.json({ ok: false, checks }, { status: 500 });
  }

  // 2. Check the SQLite file exists
  if (dbUrl.startsWith("file:")) {
    const dbPath = dbUrl.slice("file:".length);
    const fullPath = path.isAbsolute(dbPath)
      ? dbPath
      : path.join(process.cwd(), dbPath.replace(/^\.\//, ""));
    const dbFileExists = existsSync(fullPath);

    if (!dbFileExists) {
      checks.database = {
        ok: false,
        message: `Database file not found at ${fullPath}`,
        fix: "Run: npm run db:push  (this creates the SQLite file and tables)",
      };
      return NextResponse.json({ ok: false, checks }, { status: 500 });
    }
  }

  // 3. Try a simple query to verify the tables exist
  try {
    await db.setting.count();
    checks.database = {
      ok: true,
      message: "Database connected and tables exist",
    };
  } catch (e: any) {
    checks.database = {
      ok: false,
      message: `Database query failed: ${e?.message || "unknown error"}`,
      fix: "Run: npm run db:push  (this creates the tables — you may have skipped this step)",
    };
    return NextResponse.json({ ok: false, checks }, { status: 500 });
  }

  // 4. Check uploads directory
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) {
    checks.uploads = {
      ok: false,
      message: "uploads/ directory does not exist",
      fix: "It will be created automatically on first upload, or run: mkdir uploads",
    };
  } else {
    checks.uploads = { ok: true, message: "uploads/ directory exists" };
  }

  // 5. Check FFmpeg (for video processing)
  try {
    const { isFFmpegAvailable } = await import("@/lib/video-processor");
    const ffmpegOk = await isFFmpegAvailable();
    checks.ffmpeg = {
      ok: ffmpegOk,
      message: ffmpegOk ? "FFmpeg available" : "FFmpeg not found",
      fix: ffmpegOk ? undefined : "Install FFmpeg: https://ffmpeg.org/download.html",
    };
  } catch {
    checks.ffmpeg = {
      ok: false,
      message: "Could not check FFmpeg",
      fix: "Install FFmpeg for video processing",
    };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 500 });
}
