import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { spawn } from "child_process";

/**
 * POST /api/srt/generate-stream
 *
 * Streams progress updates via Server-Sent Events (SSE) while generating
 * an SRT file via faster-whisper. This lets the UI show a real progress
 * bar instead of a static spinner.
 *
 * Body: { longFormId, model? }
 *
 * SSE events:
 *   data: {"stage":"loading_model","message":"Loading Whisper model 'base'…","progress":10}
 *   data: {"stage":"transcribing","message":"Transcribing audio…","progress":30}
 *   data: {"stage":"writing_srt","message":"Writing SRT file…","progress":80}
 *   data: {"stage":"done","message":"SRT generated","progress":100,"srtContent":"1\\n00:00:00,000 --> 00:00:03,000\\n..."}
 *   data: {"stage":"error","message":"...","progress":0}
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { longFormId, model = "base" } = body || {};

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

    if (!existsSync(longForm.filePath)) {
      return new Response(
        JSON.stringify({ error: "Video file not found on disk" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    const srtPath = longForm.filePath.replace(/\.[^.]+$/, ".srt");
    const scriptPath = path.join(process.cwd(), "scripts", "generate-srt.py");
    const isWindows = process.platform === "win32";
    const pythonCmd = isWindows ? "python" : "python3";

    if (!existsSync(scriptPath)) {
      return new Response(
        JSON.stringify({ error: `SRT script not found: ${scriptPath}. Run: git pull` }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        function send(data: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }

        try {
          send({ stage: "starting", message: "Starting SRT generation…", progress: 5 });

          const proc = spawn(pythonCmd, [scriptPath, longForm.filePath, srtPath, model], {
            windowsHide: true,
          });

          let stderrBuffer = "";

          proc.stderr.on("data", (data: Buffer) => {
            const text = data.toString();
            stderrBuffer += text;

            if (text.includes("Installing via pip")) {
              send({ stage: "installing", message: "Installing faster-whisper (one-time)…", progress: 8 });
            } else if (text.includes("faster-whisper installed successfully")) {
              send({ stage: "loading_model", message: "faster-whisper installed. Loading model…", progress: 15 });
            } else if (text.includes("Loading Whisper model")) {
              send({ stage: "loading_model", message: `Loading Whisper model '${model}'…`, progress: 20 });
            } else if (text.includes("Transcribing")) {
              send({ stage: "transcribing", message: "Transcribing audio… this is the slow part", progress: 35 });
            } else if (text.includes("Detected language")) {
              const match = text.match(/Detected language: (\w+)/);
              const lang = match ? match[1] : "unknown";
              send({ stage: "transcribing", message: `Transcribing (${lang})…`, progress: 50 });
            } else if (text.includes("Duration:")) {
              const match = text.match(/Duration: ([\d.]+)s/);
              const dur = match ? match[1] : "?";
              send({ stage: "transcribing", message: `Transcribing ${dur}s of audio…`, progress: 55 });
            } else if (text.includes("SRT written")) {
              send({ stage: "writing_srt", message: "SRT file written, loading…", progress: 90 });
            }
          });

          const exitCode = await new Promise<number>((resolve) => {
            proc.on("close", resolve);
          });

          if (exitCode !== 0) {
            let errorMsg = `Python script exited with code ${exitCode}`;
            if (stderrBuffer.includes("No module named")) {
              const modMatch = stderrBuffer.match(/No module named '(\w+)'/);
              errorMsg = `Missing Python dependency: ${modMatch?.[1] || "unknown"}`;
            }
            send({ stage: "error", message: errorMsg, progress: 0, stderr: stderrBuffer.slice(-500) });
            controller.close();
            return;
          }

          const srtContent = await readFile(srtPath, "utf-8");

          await db.longFormVideo.update({
            where: { id: longFormId },
            data: { transcript: srtContent },
          });

          send({
            stage: "done",
            message: "SRT generated successfully",
            progress: 100,
            srtContent,
            segmentCount: srtContent.split("\n\n").filter(Boolean).length,
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
      JSON.stringify({ error: e?.message || "SRT generation failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
