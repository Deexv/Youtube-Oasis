/**
 * Scheduling engine for YouTube long-form videos and Shorts.
 *
 * Rules:
 *  - Long-form: exactly one per day (configurable). Random time inside the
 *    user-defined window for that video (e.g. 09:00–17:00).
 *  - Shorts: up to N per day (configurable, default 3). Scheduled directly on
 *    YouTube with a minimum 2-hour spacing between any two scheduled posts.
 *  - All times are stored as ISO strings in the user's local timezone
 *    (we use UTC under the hood; the UI converts for display).
 */

import { db } from "@/lib/db";

export type SchedulingSettings = {
  longFormPerDay: number; // default 1
  shortsPerDay: number; // default 3
  shortsMinSpacingMinutes: number; // default 120 (2 hours)
  longFormWindowStart: string; // "09:00"
  longFormWindowEnd: string; // "17:00"
};

export const DEFAULT_SETTINGS: SchedulingSettings = {
  longFormPerDay: 1,
  shortsPerDay: 3,
  shortsMinSpacingMinutes: 120,
  longFormWindowStart: "09:00",
  longFormWindowEnd: "17:00",
};

const SETTINGS_KEY = "scheduling";

export async function getSettings(): Promise<SchedulingSettings> {
  const row = await db.setting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<SchedulingSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(next: Partial<SchedulingSettings>): Promise<SchedulingSettings> {
  const current = await getSettings();
  const merged = { ...current, ...next };
  await db.setting.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(merged) },
  });
  return merged;
}

/** Parse "HH:mm" into a seconds-since-midnight value. */
function timeToSeconds(t: string): number {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 3600 + m * 60;
}

/**
 * Pick a random time inside the [windowStart, windowEnd] window for the
 * given date (a Date whose date portion will be preserved).
 * Returns a fresh Date with the chosen time.
 */
export function pickRandomTimeInWindow(
  date: Date,
  windowStart: string,
  windowEnd: string,
): Date {
  const startSec = timeToSeconds(windowStart);
  const endSec = timeToSeconds(windowEnd);
  const span = Math.max(0, endSec - startSec);
  // Bias slightly toward mid-day for natural engagement patterns
  const u = Math.random();
  const biased = u * 0.7 + Math.random() * 0.3; // [0,1)
  const offset = Math.floor(biased * span);
  const chosen = startSec + offset;
  const result = new Date(date);
  result.setHours(Math.floor(chosen / 3600), Math.floor((chosen % 3600) / 60), 0, 0);
  return result;
}

/** Format an ISO string as HH:mm for display. */
export function formatTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Format an ISO string as a friendly date. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return `${formatDay(iso)} · ${formatTimeOfDay(iso)}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Count long-form videos already scheduled for a given day. */
export async function countLongFormOnDay(day: Date): Promise<number> {
  const start = startOfDay(day);
  const end = endOfDay(day);
  return db.longFormVideo.count({
    where: {
      scheduledTime: { not: null },
      status: { in: ["scheduled", "uploaded"] },
      AND: [
        { scheduledTime: { gte: start.toISOString() } },
        { scheduledTime: { lte: end.toISOString() } },
      ],
    },
  });
}

/** Count shorts already scheduled for a given day. */
export async function countShortsOnDay(day: Date): Promise<number> {
  const start = startOfDay(day);
  const end = endOfDay(day);
  return db.short.count({
    where: {
      scheduledTime: { not: null },
      status: { in: ["scheduled", "uploaded"] },
      AND: [
        { scheduledTime: { gte: start.toISOString() } },
        { scheduledTime: { lte: end.toISOString() } },
      ],
    },
  });
}

/**
 * Find the next available day for a long-form video starting from `from`.
 * Skips days that already hit longFormPerDay.
 */
export async function findNextLongFormDay(from: Date, settings: SchedulingSettings): Promise<Date> {
  let candidate = startOfDay(from);
  // Safety cap to prevent infinite loops
  for (let i = 0; i < 60; i++) {
    const count = await countLongFormOnDay(candidate);
    if (count < settings.longFormPerDay) return candidate;
    candidate = new Date(candidate.getTime() + 24 * 3600 * 1000);
  }
  return startOfDay(from);
}

/**
 * Given a desired day, find an available slot for a Short that respects:
 *  - max shorts per day for that day
 *  - at least `minSpacingMinutes` from any other scheduled short on the same day
 * Returns the chosen ISO time, or null if no slot found on that day.
 */
export async function findShortSlotOnDay(
  day: Date,
  settings: SchedulingSettings,
  candidateStartHour = 9,
  candidateEndHour = 21,
): Promise<string | null> {
  const dayCount = await countShortsOnDay(day);
  if (dayCount >= settings.shortsPerDay) return null;

  // Get all scheduled shorts for that day
  const start = startOfDay(day);
  const end = endOfDay(day);
  const existing = await db.short.findMany({
    where: {
      scheduledTime: { not: null },
      status: { in: ["scheduled", "uploaded"] },
      AND: [
        { scheduledTime: { gte: start.toISOString() } },
        { scheduledTime: { lte: end.toISOString() } },
      ],
    },
    orderBy: { scheduledTime: "asc" },
    select: { scheduledTime: true },
  });
  const existingTimes = existing
    .map((s) => new Date(s.scheduledTime!).getTime())
    .sort((a, b) => a - b);

  const minGapMs = settings.shortsMinSpacingMinutes * 60 * 1000;
  // Try a candidate slot every 30 min from 9:00 to 21:00
  for (let h = candidateStartHour; h < candidateEndHour; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slot = new Date(day);
      slot.setHours(h, m, 0, 0);
      const slotMs = slot.getTime();
      const conflict = existingTimes.some(
        (t) => Math.abs(t - slotMs) < minGapMs,
      );
      if (!conflict) return slot.toISOString();
    }
  }
  // If the day is packed, return null
  return null;
}

/**
 * Find the next available Short slot, scanning forward day by day.
 */
export async function findNextShortSlot(
  from: Date,
  settings: SchedulingSettings,
): Promise<{ iso: string; day: Date }> {
  let candidate = startOfDay(from);
  for (let i = 0; i < 30; i++) {
    const slot = await findShortSlotOnDay(candidate, settings);
    if (slot) return { iso: slot, day: candidate };
    candidate = new Date(candidate.getTime() + 24 * 3600 * 1000);
  }
  // Fallback: just use `from` directly
  return { iso: from.toISOString(), day: startOfDay(from) };
}
