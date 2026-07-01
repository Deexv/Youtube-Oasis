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
  zai: "Z.AI (GLM)",
  groq: "Groq (Llama)",
  gemini: "Gemini",
  anthropic: "Claude",
};

/**
 * Default models per provider. These can be overridden per-provider via
 * env vars: ZAI_MODEL, GROQ_MODEL, GEMINI_MODEL, ANTHROPIC_MODEL.
 */
export const PROVIDER_DEFAULT_MODELS: Record<ProviderName, string> = {
  zai: "glm-4.6",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.5-flash",
  anthropic: "claude-haiku-4.5",
};

export const PROVIDER_ENV_KEYS: Record<ProviderName, { apiKey: string; model: string }> = {
  zai: { apiKey: "ZAI_API_KEY", model: "ZAI_MODEL" },
  groq: { apiKey: "GROQ_API_KEY", model: "GROQ_MODEL" },
  gemini: { apiKey: "GEMINI_API_KEY", model: "GEMINI_MODEL" },
  anthropic: { apiKey: "ANTHROPIC_API_KEY", model: "ANTHROPIC_MODEL" },
};
