/**
 * Client-safe constants and helpers for the LLM layer.
 * Kept separate from `llm.ts` so client components can import the labels
 * without pulling in the Node-only SDK packages.
 */

export type ProviderName = "zai" | "groq" | "gemini" | "anthropic";

export const PROVIDER_ORDER: ProviderName[] = [
  "zai",
  "groq",
  "gemini",
  "anthropic",
];

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  zai: "Z.AI (GLM-4.6)",
  groq: "Groq (Llama 3.3 70B)",
  gemini: "Gemini (2.5 Flash)",
  anthropic: "Claude (Haiku 4.5)",
};

export const PROVIDER_MODELS: Record<ProviderName, string> = {
  zai: "glm-4.6",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-haiku-4.5",
};
