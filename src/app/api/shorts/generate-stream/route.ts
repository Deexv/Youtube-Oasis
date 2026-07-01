import { db } from "@/lib/db";
import { detectArcsWithStatus } from "@/lib/zai";
import {
  processShortArc,
  getVideoDuration,
  isFFmpegAvailable,
  type SubtitleStyle,
} from "@/lib/video-processor";
import {
  parseSRT,
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
          send({ stage: "llm", message: "Analyzing transcript with LLM — finding complete narrative arcs…", progress: 5, total: 0 });

          const detection = await detectArcsWithStatus(
            transcriptForLLM || longForm.transcript || "",
            duration || 600,
          );

          if (detection.error) {
            console.warn(`[shorts/generate-stream] ${detection.error}`);
          }

          if (detection.arcs.length === 0) {
            send({ stage: "error", message: "No viable narrative arcs found.", progress: 0 });
            controller.close();
            return;
          }

          const arcs = detection.arcs;
          send({
            stage: "llm_done",
            message: `Found ${arcs.length} complete narrative arcs via ${detection.provider}`,
            progress: 15,
            total: arcs.length,
            llmProvider: detection.provider,
            llmWarning: detection.error,
          });

          send({ stage: "headers", message: "Preparing shorts…", progress: 20, total: arcs.length });

          const shortsDir = path.join(process.cwd(), "uploads", "shorts", longFormId);
          if (!existsSync(shortsDir)) {
            await mkdir(shortsDir, { recursive: true });
          }

          const BATCH_SIZE = 2;
          const created: any[] = [];
          const errors: string[] = [];
          let processed = 0;
          const total = arcs.length;

          for (let i = 0; i < arcs.length; i += BATCH_SIZE) {
            const batch = arcs.slice(i, i + BATCH_SIZE);
            const batchResults = await Promise.all(
              batch.map(async (arc, j) => {
                try {
                  const shortFileName = `short-${Date.now()}-${i + j + 1}.mp4`;
                  const shortFilePath = path.join(shortsDir, shortFileName);

                  const result = await processShortArc({
                    inputPath: longForm.filePath,
                    outputPath: shortFilePath,
                    arc,
                    subtitleStyle: subtitleStyle as SubtitleStyle,
                    subtitlesEnabled,
                    srtSegments,
                  });

                  const row = await db.short.create({
                    data: {
                      longFormId: longForm.id,
                      beat: "arc",
                      title: arc.title,
                      header: arc.header,
                      description: `6-beat arc: ${arc.clips.map((c: any) => c.beat).join(" → ")}`,
                      filePath: shortFilePath,
                      sourceStart: arc.clips[0]?.sourceStart || 0,
                      sourceEnd: arc.clips[arc.clips.length - 1]?.sourceEnd || 0,
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
                    message: `Processed short ${processed}/${total} — "${arc.header}"`,
                    progress: pct,
                    current: processed,
                    total,
                  });

                  return {
                    id: row.id,
                    beat: "arc",
                    title: arc.title,
                    header: arc.header,
                    sourceStart: row.sourceStart,
                    sourceEnd: row.sourceEnd,
                    duration: result.duration,
                    fileSize: result.fileSize,
                    subtitleStyle: row.subtitleStyle,
                    status: "ready",
                  };
                } catch (e: any) {
                  const errMsg = `Short ${i + j + 1}: ${e?.message || "unknown error"}`;
                  console.error(errMsg);
                  errors.push(errMsg);
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
            totalFound: arcs.length,
            totalProcessed: created.length,
            totalFailed: arcs.length - created.length,
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
