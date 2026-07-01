import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateSRTViaWhisper } from "@/lib/video-processor";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * POST /api/srt/generate
 * Auto-generates an SRT file from a video using faster-whisper (CPU-based, low-spec friendly).
 *
 * Body: { longFormId, model? }
 * Returns: { srtContent }
 *
 * Models: tiny | base | small | medium | large-v3 (default: base)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { longFormId, model = "base" } = body || {};

    if (!longFormId) {
      return NextResponse.json({ error: "longFormId is required" }, { status: 400 });
    }

    const longForm = await db.longFormVideo.findUnique({ where: { id: longFormId } });
    if (!longForm) {
      return NextResponse.json({ error: "Long-form video not found" }, { status: 404 });
    }

    if (!existsSync(longForm.filePath)) {
      return NextResponse.json({ error: "Video file not found on disk" }, { status: 404 });
    }

    // Generate SRT
    const srtPath = longForm.filePath.replace(/\.[^.]+$/, ".srt");
    await generateSRTViaWhisper(longForm.filePath, srtPath, model);

    // Read the SRT content
    const srtContent = await readFile(srtPath, "utf-8");

    // Save to DB
    await db.longFormVideo.update({
      where: { id: longFormId },
      data: { transcript: srtContent },
    });

    return NextResponse.json({ srtContent, model });
  } catch (e: any) {
    console.error("SRT generation error:", e);
    return NextResponse.json(
      { error: e?.message || "SRT generation failed" },
      { status: 500 },
    );
  }
}
