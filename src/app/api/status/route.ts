import { NextResponse } from "next/server";
import { isMockMode, isYouTubeConfiguredAsync } from "@/lib/youtube";
import { getProviderStatus } from "@/lib/zai";
import { getProviderModels } from "@/lib/llm";

export async function GET() {
  const configured = await isYouTubeConfiguredAsync();
  const mock = isMockMode();
  return NextResponse.json({
    youtubeMockMode: mock,
    youtubeConfigured: configured,
    youtubeLabel: mock ? "Mock" : configured ? "Live" : "Not configured",
    llm: getProviderStatus(),
    llmModels: getProviderModels(),
  });
}
