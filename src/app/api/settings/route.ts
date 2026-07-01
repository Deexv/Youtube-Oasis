import { NextResponse } from "next/server";
import { getSettings, saveSettings, DEFAULT_SETTINGS } from "@/lib/scheduler";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings, defaults: DEFAULT_SETTINGS });
  } catch (e: any) {
    // DB not initialized — return defaults so the UI doesn't crash
    return NextResponse.json({
      settings: DEFAULT_SETTINGS,
      defaults: DEFAULT_SETTINGS,
      warning: "Database not initialized. Run: npm run db:push",
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const next = await saveSettings(body || {});
    return NextResponse.json({ settings: next });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "Could not save settings. The database may not be initialized. Run: npm run db:push",
        details: e?.message,
      },
      { status: 500 },
    );
  }
}
