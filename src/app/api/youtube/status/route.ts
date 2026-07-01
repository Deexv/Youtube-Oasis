import { NextResponse } from "next/server";

export async function GET() {
  const mockMode = process.env.YOUTUBE_MOCK_MODE !== "false";
  const hasClient = Boolean(process.env.YOUTUBE_CLIENT_ID);
  return NextResponse.json({
    mockMode,
    configured: hasClient && !mockMode,
    label: mockMode ? "Mock" : "Live",
  });
}
