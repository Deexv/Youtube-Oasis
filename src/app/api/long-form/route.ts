import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  findNextLongFormDay,
  getSettings,
  pickRandomTimeInWindow,
} from "@/lib/scheduler";
import { scheduleOnYouTube } from "@/lib/youtube";

export async function GET() {
  const items = await db.longFormVideo.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { shorts: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, filePath, duration, transcript, windowStart, windowEnd, scheduleNow } =
    body || {};

  if (!title || !filePath) {
    return NextResponse.json({ error: "title and filePath are required" }, { status: 400 });
  }

  const settings = await getSettings();
  const wStart = windowStart || settings.longFormWindowStart;
  const wEnd = windowEnd || settings.longFormWindowEnd;

  let scheduledTime: string | null = null;
  let status = "draft";
  let youtubeId: string | undefined;

  if (scheduleNow) {
    const day = await findNextLongFormDay(new Date(), settings);
    const chosen = pickRandomTimeInWindow(day, wStart, wEnd);
    scheduledTime = chosen.toISOString();
    status = "scheduled";
    try {
      const yt = await scheduleOnYouTube({
        title,
        description,
        filePath,
        scheduledTime,
        tags: ["long-form"],
        categoryId: 22,
      });
      youtubeId = yt.youtubeId;
    } catch {
      status = "failed";
    }
  }

  const row = await db.longFormVideo.create({
    data: {
      title,
      description,
      filePath,
      duration: Number(duration) || 0,
      transcript,
      windowStart: wStart,
      windowEnd: wEnd,
      scheduledTime,
      status,
      youtubeId,
    },
  });

  return NextResponse.json({ item: row });
}
