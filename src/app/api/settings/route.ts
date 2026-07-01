import { NextResponse } from "next/server";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/scheduler";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings, defaults: DEFAULT_SETTINGS });
}

export async function POST(req: Request) {
  const body = await req.json();
  const next = await saveSettings(body || {});
  return NextResponse.json({ settings: next });
}
