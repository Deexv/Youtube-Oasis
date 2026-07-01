/**
 * Multi-provider LLM client with round-robin rotation.
 *
 * Supported providers (configured via .env):
 *   ZAI_API_KEY       — Z.AI (GLM-4.6) via z-ai-web-dev-sdk
 *   GROQ_API_KEY      — Groq (Llama 3.3 70B, etc.) via OpenAI-compatible API
 *   GEMINI_API_KEY    — Google Gemini (2.5 Flash) via @google/genai
 *   ANTHROPIC_API_KEY — Anthropic Claude (Haiku 4.5) via @anthropic-ai/sdk
 *
 * Rotation:
 *   LLM_ROTATE=true (default when ≥2 providers are set) — pick the next
 *   provider in the order [zai, groq, gemini, anthropic] for each call.
 *   LLM_ROTATE=false — use the first available provider in that order.
 *
 * Each provider exposes the same `chatJson()` signature so the caller
 * doesn't care which one answered.
 */

import ZAI from "z-ai-web-dev-sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";

export {
  PROVIDER_ORDER,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  type ProviderName,
} from "@/lib/llm-shared";
import {
  PROVIDER_ORDER,
  PROVIDER_MODELS,
  type ProviderName,
} from "@/lib/llm-shared";

export type ChatJsonResult = {
  content: string;
  provider: ProviderName;
  model: string;
};

// Module-level rotation cursor. Persists across calls within a single
// server process. For multi-instance deployments you'd move this to Redis
// or similar — but for a single-node scheduler this is fine.
let rotationCursor = 0;

export function getConfiguredProviders(): ProviderName[] {
  return PROVIDER_ORDER.filter((p) => {
    switch (p) {
      case "zai":
        return Boolean(process.env.ZAI_API_KEY);
      case "groq":
        return Boolean(process.env.GROQ_API_KEY);
      case "gemini":
        return Boolean(process.env.GEMINI_API_KEY);
      case "anthropic":
        return Boolean(process.env.ANTHROPIC_API_KEY);
    }
  });
}

export function isRotationEnabled(): boolean {
  const configured = getConfiguredProviders();
  if (configured.length < 2) return false;
  const v = process.env.LLM_ROTATE;
  if (v === undefined) return true; // default on when ≥2 providers
  return v === "true" || v === "1" || v === "yes";
}

/**
 * Pick the next provider to use, honouring rotation settings.
 */
export function pickNextProvider(): ProviderName | null {
  const configured = getConfiguredProviders();
  if (configured.length === 0) return null;
  if (!isRotationEnabled()) return configured[0];
  const pick = configured[rotationCursor % configured.length];
  rotationCursor += 1;
  return pick;
}

export type ChatJsonInput = {
  system: string;
  user: string;
  temperature?: number;
};

/**
 * Send a chat completion request and ask for JSON output. Returns the raw
 * text content; the caller is responsible for parsing JSON out of it.
 *
 * Tries the picked provider first; on failure, falls back to the next
 * configured provider until one succeeds or all are exhausted.
 */
export async function chatJson(input: ChatJsonInput): Promise<ChatJsonResult> {
  const configured = getConfiguredProviders();
  if (configured.length === 0) {
    throw new Error(
      "No LLM provider configured. Set at least one of ZAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY in .env.",
    );
  }

  // Build the attempt order: rotation pick first, then the rest.
  const first = pickNextProvider();
  const attemptOrder: ProviderName[] = first
    ? [first, ...configured.filter((p) => p !== first)]
    : configured;

  let lastError: unknown = null;
  for (const provider of attemptOrder) {
    try {
      const result = await callProvider(provider, input);
      return { ...result, provider };
    } catch (e) {
      lastError = e;
      // Try the next provider
      continue;
    }
  }

  throw new Error(
    `All configured LLM providers failed. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

async function callProvider(
  provider: ProviderName,
  input: ChatJsonInput,
): Promise<{ content: string; model: string }> {
  switch (provider) {
    case "zai":
      return callZai(input);
    case "groq":
      return callGroq(input);
    case "gemini":
      return callGemini(input);
    case "anthropic":
      return callAnthropic(input);
  }
}

async function callZai(input: ChatJsonInput): Promise<{ content: string; model: string }> {
  const zai = await ZAI.create();
  const res = await zai.chat.completions.create({
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    temperature: input.temperature ?? 0.7,
    response_format: { type: "json_object" },
  } as any);
  const content = res?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Z.AI returned empty content");
  return { content, model: PROVIDER_MODELS.zai };
}

async function callGroq(input: ChatJsonInput): Promise<{ content: string; model: string }> {
  const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY!,
    baseURL: "https://api.groq.com/openai/v1",
  });
  const res = await client.chat.completions.create({
    model: PROVIDER_MODELS.groq,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    temperature: input.temperature ?? 0.7,
    response_format: { type: "json_object" },
  });
  const content = res.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Groq returned empty content");
  return { content, model: PROVIDER_MODELS.groq };
}

async function callGemini(input: ChatJsonInput): Promise<{ content: string; model: string }> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const res = await client.models.generateContent({
    model: PROVIDER_MODELS.gemini,
    contents: input.user,
    config: {
      systemInstruction: input.system,
      temperature: input.temperature ?? 0.7,
      responseMimeType: "application/json",
    },
  });
  const content = res.text ?? "";
  if (!content) throw new Error("Gemini returned empty content");
  return { content, model: PROVIDER_MODELS.gemini };
}

async function callAnthropic(input: ChatJsonInput): Promise<{ content: string; model: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const res = await client.messages.create({
    model: PROVIDER_MODELS.anthropic,
    max_tokens: 2048,
    system: input.system,
    messages: [{ role: "user", content: input.user }],
    temperature: input.temperature ?? 0.7,
  });
  // Anthropic returns content blocks; concatenate text blocks.
  const content = res.content
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  if (!content) throw new Error("Anthropic returned empty content");
  return { content, model: PROVIDER_MODELS.anthropic };
}
