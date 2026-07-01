import { NextResponse } from "next/server";
import { scheduleOnYouTube } from "@/lib/youtube";
import { db } from "@/lib/db";

/**
 * Manually schedule an existing video (long-form or short) on YouTube.
 * Body: { id, type: "long"|"short", scheduledTime (ISO) }
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { id, type, scheduledTime } = body || {};
  if (!id || !type || !scheduledTime) {
    return NextResponse.json({ error: "id, type, scheduledTime required" }, { status: 400 });
  }

  const row =
    type === "long"
      ? await db.longFormVideo.findUnique({ where: { id } })
      : await db.short.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const yt = await scheduleOnYouTube({
    title: row.title,
    description: row.description ?? undefined,
    filePath: row.filePath,
    scheduledTime,
    isShort: type === "short",
    categoryId: type === "long" ? 22 : 24,
  });

  const update = { scheduledTime, youtubeId: yt.youtubeId, status: "scheduled" as const };
  if (type === "long") {
    await db.longFormVideo.update({ where: { id }, data: update });
  } else {
    await db.short.update({ where: { id }, data: update });
  }
  return NextResponse.json({ item: { ...row, ...update }, youtube: yt });
}
