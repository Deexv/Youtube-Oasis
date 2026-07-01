import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { spawn } from "child_process";

/**
 * POST /api/srt/generate-stream
 *
 * Streams progress updates via Server-Sent Events (SSE) while generating
 * an SRT file via faster-whisper.
 *
 * The Python script emits PROGRESS: messages on stderr that we parse:
 *   PROGRESS:installing
 *   PROGRESS:loading_model
 *   PROGRESS:transcribing
 *   PROGRESS:language:en:180.5
 *   PROGRESS:transcribing:45:12:81.3/180.5s
 *   PROGRESS:writing_srt:12
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
            shell: isWindows, // Required on Windows to find python.exe
          });

          let stderrBuffer = "";

          proc.stderr.on("data", (data: Buffer) => {
            const text = data.toString();
            stderrBuffer += text;

            // Parse PROGRESS: messages from the Python script
            const lines = text.split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith("PROGRESS:")) {
                const parts = trimmed.slice("PROGRESS:".length).split(":");
                const stage = parts[0];

                if (stage === "installing") {
                  send({ stage: "installing", message: "Installing faster-whisper (one-time)…", progress: 8 });
                } else if (stage === "loading_model") {
                  send({ stage: "loading_model", message: `Loading Whisper model '${model}'…`, progress: 15 });
                } else if (stage === "transcribing" && parts.length === 1) {
                  send({ stage: "transcribing", message: "Transcribing audio…", progress: 35 });
                } else if (stage === "language") {
                  const lang = parts[1] || "unknown";
                  const duration = parseFloat(parts[2] || "0");
                  const durMsg = duration > 0 ? ` (${Math.round(duration)}s of audio)` : "";
                  send({
                    stage: "transcribing",
                    message: `Transcribing${durMsg} — language: ${lang}`,
                    progress: 38,
                  });
                } else if (stage === "transcribing" && parts.length >= 3) {
                  // PROGRESS:transcribing:45:12:81.3/180.5s
                  const pct = parseInt(parts[1], 10);
                  const segCount = parseInt(parts[2], 10);
                  const position = parts[3] || "";
                  send({
                    stage: "transcribing",
                    message: `Transcribing — ${segCount} segments found, at ${position}`,
                    progress: pct,
                  });
                } else if (stage === "writing_srt") {
                  const segCount = parseInt(parts[1] || "0", 10);
                  send({
                    stage: "writing_srt",
                    message: `Writing SRT file (${segCount} segments)…`,
                    progress: 90,
                  });
                }
              }
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

          const segmentCount = srtContent.split("\n\n").filter(Boolean).length;

          send({
            stage: "done",
            message: `SRT generated — ${segmentCount} segments`,
            progress: 100,
            srtContent,
            segmentCount,
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
