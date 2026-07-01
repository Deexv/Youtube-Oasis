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
import { mkdir } from "fs/promises";
import { existsSync } from "fs";

/**
 * POST /api/shorts/generate-stream
 *
 * Streams progress via SSE for the full shorts pipeline.
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
      return new Response(
        JSON.stringify({ error: "longFormId is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const longForm = await db.longFormVideo.findUnique({ where: { id: longFormId } });
    if (!longForm) {
      return new Response(
        JSON.stringify({ error: "Long-form video not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!(await isFFmpegAvailable())) {
      return new Response(
        JSON.stringify({ error: "FFmpeg is not installed." }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

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

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          send({ stage: "llm", message: "Analyzing transcript with LLM…", progress: 5, total: 0 });

          const detection = await detectMomentsWithStatus(
            transcriptForLLM || longForm.transcript || "",
            duration || 600,
          );

          if (detection.error) {
            console.warn(`[shorts/generate-stream] ${detection.error}`);
          }

          if (detection.moments.length === 0) {
            send({ stage: "error", message: "No viable moments found.", progress: 0 });
            controller.close();
            return;
          }

          const moments = detection.moments;
          send({
            stage: "llm_done",
            message: `Found ${moments.length} moments via ${detection.provider}`,
            progress: 15,
            total: moments.length,
            llmProvider: detection.provider,
            llmWarning: detection.error,
          });

          send({ stage: "headers", message: "Generating viral headers…", progress: 20, total: moments.length });

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

          const shortsDir = path.join(process.cwd(), "uploads", "shorts", longFormId);
          if (!existsSync(shortsDir)) {
            await mkdir(shortsDir, { recursive: true });
          }

          const BATCH_SIZE = 2;
          const created: any[] = [];
          const errors: string[] = [];
          let processed = 0;
          const total = moments.length;

          for (let i = 0; i < moments.length; i += BATCH_SIZE) {
            const batch = moments.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
              batch.map(async (m, j) => {
                try {
                  const header = headers[i + j] || m.title;
                  const segSrt = extractSrtSegment(srtSegments, m.sourceStart, m.sourceEnd);
                  const shortFileName = `short-${Date.now()}-${i + j + 1}-${m.beat}.mp4`;
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

                  processed++;
                  const pct = 20 + Math.round((processed / total) * 75);
                  send({
                    stage: "processing",
                    message: `Processed short ${processed}/${total} (${m.beat})`,
                    progress: pct,
                    current: processed,
                    total,
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
                    status: "ready",
                  };
                } catch (e: any) {
                  const errMsg = `Short ${i + j + 1} (${m.beat}): ${e?.message || "unknown error"}`;
                  console.error(errMsg);
                  errors.push(errMsg);
                  // Send the error to the client so the user can see what's failing
                  send({
                    stage: "short_error",
                    message: errMsg,
                    progress: 20 + Math.round((processed / total) * 75),
                  });
                  return null;
                }
              }),
            );
            created.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
          }

          send({
            stage: "done",
            message: `Created ${created.length} shorts${errors.length > 0 ? ` (${errors.length} failed)` : ""}`,
            progress: 100,
            created,
            totalFound: moments.length,
            totalProcessed: created.length,
            totalFailed: moments.length - created.length,
            llmProvider: detection.provider,
            llmWarning: detection.error,
            errors: errors.length > 0 ? errors : undefined,
          });
        } catch (e: any) {
          send({ stage: "error", message: e?.message || "Unknown error", progress: 0 });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "Failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
