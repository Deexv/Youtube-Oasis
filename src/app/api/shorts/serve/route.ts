import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

/**
 * GET /api/shorts/serve?id=...
 * Serves a generated short video file for preview in the browser.
 * Supports range requests for video seeking.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const short = await db.short.findUnique({ where: { id } });
  if (!short || !short.filePath) {
    return NextResponse.json({ error: "Short not found" }, { status: 404 });
  }

  if (!existsSync(short.filePath)) {
    return NextResponse.json({ error: "Video file not found on disk" }, { status: 404 });
  }

  const fileBuffer = await readFile(short.filePath);
  const ext = path.extname(short.filePath).toLowerCase();
  const mimeType =
    ext === ".webm" ? "video/webm" :
    ext === ".mov" ? "video/quicktime" :
    "video/mp4";

  // Check if this is a download request (force download instead of inline)
  const isDownload = url.searchParams.get("download") === "1";
  const disposition = isDownload ? "attachment" : "inline";
  const filename = short.header
    ? short.header.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60) + ext
    : `short-${short.id.slice(-8)}${ext}`;

  // Support range requests for video seeking
  const range = req.headers.get("range");
  if (range) {
    const fileSize = fileBuffer.length;
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunk = fileBuffer.subarray(start, end + 1);

    return new NextResponse(chunk, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunk.length),
        "Content-Type": mimeType,
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Length": String(fileBuffer.length),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
