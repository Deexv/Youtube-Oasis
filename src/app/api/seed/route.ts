import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSettings, pickRandomTimeInWindow, findNextLongFormDay } from "@/lib/scheduler";

const SAMPLE_TRANSCRIPTS = [
  `Today we're going to break down exactly how a small creator grew to 100k subscribers in 90 days.
The first thing to understand is that the algorithm doesn't care about you — it cares about retention.
Most people post a video and hope. Hope is not a strategy.
So we looked at the data, and we found that the videos that won had a specific structure.
Step one: open with a problem the viewer can feel. Not "today I'll show you" — instead: "you're losing money every day you don't fix this."
Then we build stakes. We show what happens if you ignore it.
Then conflict. We introduce the obstacle that everyone trips over.
Then the comeback. The process we used to get past the obstacle.
Then we build tension — the moment where it could still all fall apart.
And finally, the reveal — the result, backed by proof.`,
  `In this video I want to talk about something that almost nobody gets right: deep work in a noisy world.
The problem isn't time. You have time. The problem is attention.
We are conditioning ourselves to interrupt our own focus every 90 seconds.
So here's the framework. First, isolate the input that breaks you.
For me, it was the phone notification pulse — not even the sound, just the screen lighting up.
Then we build a wall. Airplane mode is the wall.
But the wall alone isn't enough — you have to train the muscle.
By week two, I was doing 90 minute blocks without flinching.
By week four, my output doubled. Not because I worked more hours — because each hour actually counted.`,
];

const SAMPLE_TITLES = [
  "How a Small Creator Hit 100k Subs in 90 Days",
  "Deep Work in a Noisy World: A 30-Day Field Test",
  "The Pricing Mistake That Killed My First SaaS",
  "Why Your YouTube Thumbnails Aren't Working",
];

export async function POST() {
  // Wipe existing
  await db.short.deleteMany();
  await db.longFormVideo.deleteMany();

  const settings = await getSettings();
  const now = new Date();

  const longs = [];
  for (let i = 0; i < 4; i++) {
    const day = await findNextLongFormDay(new Date(now.getTime() + i * 24 * 3600 * 1000), settings);
    const scheduledTime = pickRandomTimeInWindow(day, settings.longFormWindowStart, settings.longFormWindowEnd);
    const l = await db.longFormVideo.create({
      data: {
        title: SAMPLE_TITLES[i % SAMPLE_TITLES.length],
        description: "Auto-seeded demo long-form video for the dashboard.",
        filePath: `/uploads/sample-${i}.mp4`,
        duration: 720 + i * 60,
        transcript: SAMPLE_TRANSCRIPTS[i % SAMPLE_TRANSCRIPTS.length],
        windowStart: settings.longFormWindowStart,
        windowEnd: settings.longFormWindowEnd,
        scheduledTime: scheduledTime.toISOString(),
        status: "scheduled",
        youtubeId: `seed${i.toString().padStart(2, "0")}abcDEFG`,
      },
    });
    longs.push(l);
  }

  return NextResponse.json({ seeded: longs.length });
}
