import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { detectMomentsWithStatus, generateShortHeader } from "@/lib/zai";
import {
  processShort,
  getVideoDuration,
  isFFmpegAvailable,
  type SubtitleStyle,
} from "@/lib/video-processor";
import {
  parseSRT,
  extractSrtSegment,
  srtToTranscript,
} from "@/lib/srt";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

/**
 * POST /api/shorts/generate-v2
 *
 * The full shorts generation pipeline:
 *   1. Find the long-form video + its SRT (or raw transcript)
 *   2. Call the LLM to detect ALL viable moments (1-15+)
 *   3. For each moment:
 *      a. Cut the segment from the source video via FFmpeg
 *      b. Convert to 9:16 vertical (1080x1920)
 *      c. Burn viral-style subtitles (ASS format)
 *      d. Add title header + duration overlay
 *   4. Store each short in the DB with a real file path
 *   5. Do NOT auto-schedule — the user previews and picks which to schedule
 *
 * Body:
 *   { longFormId, srtContent?, subtitleStyle?, subtitlesEnabled? }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      longFormId,
      srtContent,
      subtitleStyle = "pop",
      subtitlesEnabled = true,
    } = body || {};

    if (!longFormId) {
      return NextResponse.json({ error: "longFormId is required" }, { status: 400 });
    }

    const longForm = await db.longFormVideo.findUnique({ where: { id: longFormId } });
    if (!longForm) {
      return NextResponse.json({ error: "Long-form video not found" }, { status: 404 });
    }

    if (!(await isFFmpegAvailable())) {
      return NextResponse.json(
        { error: "FFmpeg is not installed. Install it with: apt install ffmpeg (Linux) or brew install ffmpeg (macOS) or download from ffmpeg.org (Windows)." },
        { status: 500 },
      );
    }

    // Parse SRT if provided, otherwise use the raw transcript
    let transcriptForLLM = "";
    let srtSegments: ReturnType<typeof parseSRT> = [];

    if (srtContent) {
      srtSegments = parseSRT(srtContent);
      transcriptForLLM = srtToTranscript(srtSegments);
      await db.longFormVideo.update({
        where: { id: longFormId },
        data: { transcript: srtContent },
      });
    } else if (longForm.transcript) {
      srtSegments = parseSRT(longForm.transcript);
      transcriptForLLM = srtSegments.length > 0
        ? srtToTranscript(srtSegments)
        : longForm.transcript;
    }

    // Get video duration if not set
    let duration = longForm.duration || 0;
    if (!duration) {
      duration = await getVideoDuration(longForm.filePath);
      if (duration) {
        await db.longFormVideo.update({
          where: { id: longFormId },
          data: { duration: Math.floor(duration) },
        });
      }
    }

    // Step 1: Detect moments via LLM (with status reporting)
    const detection = await detectMomentsWithStatus(
      transcriptForLLM || longForm.transcript || "",
      duration || 600,
    );

    if (detection.error) {
      console.warn(`[shorts/generate-v2] ${detection.error}`);
    }

    if (detection.moments.length === 0) {
      return NextResponse.json({ error: "No viable moments found in the video." }, { status: 422 });
    }

    const moments = detection.moments;

    // Ensure shorts output directory exists
    const shortsDir = path.join(process.cwd(), "uploads", "shorts", longFormId);
    if (!existsSync(shortsDir)) {
      await mkdir(shortsDir, { recursive: true });
    }

    // Step 2: Generate headers for ALL moments first (in parallel via LLM)
    const headerPromises = moments.map((m) =>
      generateShortHeader({
        beat: m.beat,
        title: m.title,
        rationale: m.rationale,
        sourceStart: m.sourceStart,
        sourceEnd: m.sourceEnd,
      }).catch(() => null),
    );
    const headers = await Promise.all(headerPromises);

    // Step 3: Process all moments into video files IN PARALLEL
    // (FFmpeg is CPU-bound, but parallel processing still helps because each
    // process has its own thread pool for encoding)
    const processPromises = moments.map(async (m, i) => {
      try {
        const header = headers[i] || m.title;

        const segSrt = extractSrtSegment(srtSegments, m.sourceStart, m.sourceEnd);

        const shortFileName = `short-${Date.now()}-${i + 1}-${m.beat}.mp4`;
        const shortFilePath = path.join(shortsDir, shortFileName);

        const result = await processShort({
          inputPath: longForm.filePath,
          outputPath: shortFilePath,
          startSec: m.sourceStart,
          endSec: m.sourceEnd,
          title: header,
          subtitleSegments: segSrt,
          subtitleStyle: subtitleStyle as SubtitleStyle,
          subtitlesEnabled,
        });

        const row = await db.short.create({
          data: {
            longFormId: longForm.id,
            beat: m.beat,
            title: m.title,
            header,
            description: m.rationale,
            filePath: shortFilePath,
            sourceStart: m.sourceStart,
            sourceEnd: m.sourceEnd,
            duration: result.duration,
            subtitleStyle,
            status: "ready",
            accountId: longForm.accountId || null,
          },
        });

        return {
          id: row.id,
          beat: row.beat,
          title: row.title,
          header,
          sourceStart: row.sourceStart,
          sourceEnd: row.sourceEnd,
          duration: result.duration,
          fileSize: result.fileSize,
          subtitleStyle: row.subtitleStyle,
          status: "ready" as const,
        };
      } catch (e: any) {
        console.error(`Failed to process moment ${m.beat}: ${e?.message}`);
        return null;
      }
    });

    const results = await Promise.all(processPromises);
    const created = results.filter((r): r is NonNullable<typeof r> => r !== null);

    return NextResponse.json({
      created,
      totalFound: moments.length,
      totalProcessed: created.length,
      totalFailed: moments.length - created.length,
      llmProvider: detection.provider,
      llmWarning: detection.error,
    });
  } catch (e: any) {
    console.error("Shorts generation error:", e);
    return NextResponse.json(
      { error: e?.message || "Shorts generation failed" },
      { status: 500 },
    );
  }
}
