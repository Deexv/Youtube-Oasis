import { NextResponse } from "next/server";
import { getUpcomingSchedule } from "@/lib/shorts-pipeline";

export async function GET() {
  const items = await getUpcomingSchedule(40);
  return NextResponse.json({ items });
}
