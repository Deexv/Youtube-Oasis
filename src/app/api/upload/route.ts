import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Allow large uploads (videos). The actual cap is enforced by
// UPLOAD_MAX_SIZE_MB / the dashboard Settings uploadLimitMb.
export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes

/**
 * POST /api/upload
 * Accepts a multipart/form-data upload with a single video file.
 * Saves to /uploads/ (gitignored). Returns the file path + metadata.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const title = formData.get("title") as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded. Use multipart/form-data with a 'file' field." },
        { status: 400 },
      );
    }

    const allowedMimes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-matroska",
      "video/avi",
      "video/mpeg",
      "video/ogg",
    ];
    const allowedExtensions = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".mpeg", ".ogv"];
    const ext = path.extname(file.name).toLowerCase();

    if (!allowedMimes.includes(file.type) && !allowedExtensions.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type || ext}. Allowed: ${allowedExtensions.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Check DB is initialized before trying to read settings
    let maxBytes: number;
    try {
      const settingsRow = await db.setting.findUnique({
        where: { key: "scheduling" },
      });
      if (settingsRow) {
        try {
          const s = JSON.parse(settingsRow.value);
          maxBytes = (s.uploadLimitMb || 2048) * 1024 * 1024;
        } catch {
          maxBytes = Number(process.env.UPLOAD_MAX_SIZE_MB || 2048) * 1024 * 1024;
        }
      } else {
        maxBytes = Number(process.env.UPLOAD_MAX_SIZE_MB || 2048) * 1024 * 1024;
      }
    } catch (dbErr: any) {
      // DB not initialized — use default limit and warn in the response
      console.error("DB error in upload route (using default limit):", dbErr?.message);
      maxBytes = Number(process.env.UPLOAD_MAX_SIZE_MB || 2048) * 1024 * 1024;
    }

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Limit is ${Math.floor(maxBytes / 1024 / 1024)} MB.`,
        },
        { status: 413 },
      );
    }

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
    const fileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadsDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    return NextResponse.json({
      filePath,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "video/mp4",
      title: title || file.name.replace(/\.[^/.]+$/, ""),
    });
  } catch (e: any) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e?.message || "Upload failed" },
      { status: 500 },
    );
  }
}
