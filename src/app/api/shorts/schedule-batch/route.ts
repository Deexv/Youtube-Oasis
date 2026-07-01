import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findNextShortSlot, getSettings } from "@/lib/scheduler";
import { scheduleOnYouTube } from "@/lib/youtube";

/**
 * POST /api/shorts/schedule-batch
 * Schedule selected shorts on YouTube with proper spacing.
 *
 * Body: { shortIds: string[] }
 * Returns: { scheduled: number, failed: number, results: [...] }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shortIds } = body || {};

    if (!Array.isArray(shortIds) || shortIds.length === 0) {
      return NextResponse.json({ error: "shortIds array is required" }, { status: 400 });
    }

    const settings = await getSettings();
    const results: Array<{ id: string; status: string; scheduledTime?: string; youtubeId?: string; error?: string }> = [];
    let scheduled = 0;
    let failed = 0;

    // Start scheduling from "now"
    let cursor = new Date();

    for (const id of shortIds) {
      const short = await db.short.findUnique({ where: { id } });
      if (!short) {
        results.push({ id, status: "failed", error: "Not found" });
        failed++;
        continue;
      }

      if (short.status === "scheduled" || short.status === "uploaded") {
        results.push({ id, status: short.status, scheduledTime: short.scheduledTime || undefined });
        continue;
      }

      try {
        // Find the next available slot
        const slot = await findNextShortSlot(cursor, settings);
        const scheduledTime = slot.iso;
        cursor = new Date(new Date(slot.iso).getTime() + settings.shortsMinSpacingMinutes * 60 * 1000);

        // Get the long-form's account
        const longForm = await db.longFormVideo.findUnique({
          where: { id: short.longFormId },
          select: { accountId: true },
        });

        // Schedule on YouTube
        const yt = await scheduleOnYouTube({
          title: short.header || short.title,
          description: short.description || "",
          filePath: short.filePath,
          scheduledTime,
          isShort: true,
          tags: [short.beat, "shorts", "auto-generated"],
          categoryId: 24,
          accountId: longForm?.accountId || null,
        });

        await db.short.update({
          where: { id },
          data: {
            scheduledTime,
            youtubeId: yt.youtubeId,
            status: "scheduled",
            accountId: longForm?.accountId || null,
          },
        });

        results.push({ id, status: "scheduled", scheduledTime, youtubeId: yt.youtubeId });
        scheduled++;
      } catch (e: any) {
        await db.short.update({
          where: { id },
          data: { status: "failed" },
        });
        results.push({ id, status: "failed", error: e?.message || "Unknown error" });
        failed++;
      }
    }

    return NextResponse.json({ scheduled, failed, results });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Batch schedule failed" },
      { status: 500 },
    );
  }
}
