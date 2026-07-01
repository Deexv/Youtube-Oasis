import { NextResponse } from "next/server";
import { getConfiguredProviders, getProviderModels, chatJson } from "@/lib/llm";
import { PROVIDER_LABELS } from "@/lib/llm-shared";

/**
 * GET /api/llm/test
 *
 * Tests whether the LLM providers are actually working by:
 *   1. Listing which providers are configured (keys present in env)
 *   2. Listing the model for each provider
 *   3. Actually calling the first configured provider with a simple prompt
 *      to verify the key works
 *
 * This is the diagnostic endpoint — if shorts generation says "LLM: fallback",
 * visit this endpoint to see why.
 */
export async function GET() {
  const configured = getConfiguredProviders();
  const models = getProviderModels();

  const providers = configured.map((p) => ({
    name: p,
    label: PROVIDER_LABELS[p],
    model: models[p].model,
    keyPresent: models[p].configured,
  }));

  if (configured.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No LLM providers configured. Set at least one API key in .env.",
      providers: [],
      envCheck: {
        ZAI_API_KEY: process.env.ZAI_API_KEY ? "set" : "not set",
        GROQ_API_KEY: process.env.GROQ_API_KEY ? "set" : "not set",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? "set" : "not set",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "set" : "not set",
      },
    });
  }

  // Actually test the first configured provider
  try {
    const result = await chatJson({
      system: "You are a test. Respond with JSON: {\"ok\": true, \"message\": \"hello\"}",
      user: "Test connection. Reply with the JSON.",
      temperature: 0,
    });

    return NextResponse.json({
      ok: true,
      providers,
      testCall: {
        provider: result.provider,
        model: result.model,
        response: result.content.slice(0, 200),
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: `LLM call failed: ${e?.message || "unknown error"}`,
      providers,
      envCheck: {
        ZAI_API_KEY: process.env.ZAI_API_KEY ? `set (${process.env.ZAI_API_KEY.slice(0, 8)}...)` : "not set",
        GROQ_API_KEY: process.env.GROQ_API_KEY ? `set (${process.env.GROQ_API_KEY.slice(0, 8)}...)` : "not set",
        GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `set (${process.env.GEMINI_API_KEY.slice(0, 8)}...)` : "not set",
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? `set (${process.env.ANTHROPIC_API_KEY.slice(0, 8)}...)` : "not set",
      },
    });
  }
}
