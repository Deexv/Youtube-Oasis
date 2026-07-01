import { NextResponse } from "next/server";
import { generateShortsFromLongForm } from "@/lib/shorts-pipeline";
import { isZaiConfigured } from "@/lib/zai";

export async function POST(req: Request) {
  const body = await req.json();
  const { longFormId, autoSchedule = true } = body || {};
  if (!longFormId) {
    return NextResponse.json({ error: "longFormId is required" }, { status: 400 });
  }
  try {
    const result = await generateShortsFromLongForm(longFormId, { autoSchedule });
    return NextResponse.json({
      ...result,
      zaiConfigured: isZaiConfigured(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
