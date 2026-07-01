import { NextResponse } from "next/server";
import { isMockMode, isYouTubeConfigured } from "@/lib/youtube";
import { getProviderStatus } from "@/lib/zai";

export async function GET() {
  const configured = isYouTubeConfigured();
  const mock = isMockMode();
  return NextResponse.json({
    youtubeMockMode: mock,
    youtubeConfigured: configured,
    youtubeLabel: mock ? "Mock" : configured ? "Live" : "Not configured",
    llm: getProviderStatus(),
  });
}
