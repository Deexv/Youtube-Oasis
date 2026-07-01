/**
 * Shorts pipeline:
 *   long-form video → Z.AI moment detection → header generation →
 *   DB rows → auto-scheduling with 2-hour spacing → native YouTube schedule.
 */

import { db } from "@/lib/db";
import {
  detectMoments,
  generateShortHeader,
  type GeneratedShort,
} from "@/lib/zai";
import {
  findNextShortSlot,
  getSettings,
  type SchedulingSettings,
} from "@/lib/scheduler";
import { scheduleOnYouTube } from "@/lib/youtube";

export type GenerateShortsResult = {
  created: Array<{
    id: string;
    beat: string;
    title: string;
    header: string;
    sourceStart: number;
    sourceEnd: number;
    scheduledTime: string | null;
    status: string;
  }>;
  scheduledCount: number;
  totalDurationSec: number;
};

export async function generateShortsFromLongForm(
  longFormId: string,
  opts?: { autoSchedule?: boolean },
): Promise<GenerateShortsResult> {
  const autoSchedule = opts?.autoSchedule ?? true;
  const longForm = await db.longFormVideo.findUnique({ where: { id: longFormId } });
  if (!longForm) throw new Error("Long-form video not found");

  const transcript = longForm.transcript || "";
  const moments = await detectMoments(transcript, longForm.duration || 600);

  const settings = await getSettings();
  const created: GenerateShortsResult["created"] = [];
  let scheduledCount = 0;

  // Start scheduling from "now" so the first short lands ASAP.
  let cursor = new Date();

  for (const m of moments) {
    const header = await generateShortHeader({
      beat: m.beat,
      title: m.title,
      rationale: m.rationale,
      sourceStart: m.sourceStart,
      sourceEnd: m.sourceEnd,
    });

    let scheduledTime: string | null = null;
    let status = "ready";

    if (autoSchedule) {
      const slot = await findNextShortSlot(cursor, settings);
      scheduledTime = slot.iso;
      cursor = new Date(new Date(slot.iso).getTime() + settings.shortsMinSpacingMinutes * 60 * 1000);
      status = "scheduled";
    }

    const filePath = `${longForm.filePath}#t=${m.sourceStart},${m.sourceEnd}`;

    const row = await db.short.create({
      data: {
        longFormId: longForm.id,
        beat: m.beat,
        title: m.title,
        header,
        description: m.rationale,
        filePath,
        sourceStart: m.sourceStart,
        sourceEnd: m.sourceEnd,
        duration: m.sourceEnd - m.sourceStart,
        scheduledTime,
        status,
        subtitleStyle: "pop",
        accountId: longForm.accountId || null,
      },
    });

    // Native YouTube schedule call — uses the long-form's account
    if (autoSchedule && scheduledTime) {
      try {
        const yt = await scheduleOnYouTube({
          title: header,
          description: m.rationale,
          filePath,
          scheduledTime,
          isShort: true,
          tags: [m.beat, "shorts", "auto-generated"],
          categoryId: 24,
          accountId: longForm.accountId || null,
        });
        await db.short.update({
          where: { id: row.id },
          data: { youtubeId: yt.youtubeId, status: "scheduled" },
        });
        scheduledCount += 1;
      } catch {
        await db.short.update({
          where: { id: row.id },
          data: { status: "failed" },
        });
      }
    }

    created.push({
      id: row.id,
      beat: row.beat,
      title: row.title,
      header,
      sourceStart: row.sourceStart,
      sourceEnd: row.sourceEnd,
      scheduledTime: row.scheduledTime,
      status,
    });
  }

  return {
    created,
    scheduledCount,
    totalDurationSec: longForm.duration || 0,
  };
}

export type ScheduledPost = {
  id: string;
  type: "long" | "short";
  title: string;
  header?: string;
  beat?: string;
  scheduledTime: string;
  status: string;
  youtubeId?: string;
  accountId?: string | null;
  account?: { id: string; displayName: string; color: string; avatarUrl?: string | null } | null;
};

export async function getUpcomingSchedule(limit = 20): Promise<ScheduledPost[]> {
  const now = new Date().toISOString();
  const [longs, shorts] = await Promise.all([
    db.longFormVideo.findMany({
      where: {
        scheduledTime: { gte: now },
        status: { in: ["scheduled", "uploaded"] },
      },
      orderBy: { scheduledTime: "asc" },
      take: limit,
      include: {
        account: { select: { id: true, displayName: true, color: true, avatarUrl: true } },
      },
    }),
    db.short.findMany({
      where: {
        scheduledTime: { gte: now },
        status: { in: ["scheduled", "uploaded"] },
      },
      orderBy: { scheduledTime: "asc" },
      take: limit,
      include: {
        account: { select: { id: true, displayName: true, color: true, avatarUrl: true } },
      },
    }),
  ]);

  const merged: ScheduledPost[] = [
    ...longs.map((l) => ({
      id: l.id,
      type: "long" as const,
      title: l.title,
      scheduledTime: l.scheduledTime!,
      status: l.status,
      youtubeId: l.youtubeId ?? undefined,
      accountId: l.accountId,
      account: l.account,
    })),
    ...shorts.map((s) => ({
      id: s.id,
      type: "short" as const,
      title: s.title,
      header: s.header ?? undefined,
      beat: s.beat,
      scheduledTime: s.scheduledTime!,
      status: s.status,
      youtubeId: s.youtubeId ?? undefined,
      accountId: s.accountId,
      account: s.account,
    })),
  ];
  return merged.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)).slice(0, limit);
}
