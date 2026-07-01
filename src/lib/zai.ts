/**
 * Z.AI-powered short-moment detection and header generation.
 *
 * Now backed by the multi-provider LLM layer in `@/lib/llm` — supports
 * Z.AI, Groq, Gemini and Claude with optional round-robin rotation.
 *
 * Uses the user-supplied narrative beat pattern:
 *   hook/problem → rising-action/assess → conflict/isolate →
 *   comeback/process → build tension → reveal
 *
 * If NO provider is configured, falls back to a deterministic heuristic
 * so the dashboard stays usable for demos.
 */

export {
  BEAT_LABELS,
  BEAT_ORDER,
  type NarrativeBeat,
  type DetectedMoment,
  type GeneratedShort,
} from "@/lib/beats";
import { BEAT_LABELS, BEAT_ORDER, type NarrativeBeat, type DetectedMoment } from "@/lib/beats";
import { chatJson, getConfiguredProviders, type ProviderName } from "@/lib/llm";

const SYSTEM_PROMPT = `You are a viral short-form video editor.
You find ALL viable moments in a long-form video transcript and tag each one with a narrative beat.

Use this exact 6-beat narrative pattern (declare the hook/problem, rising-action/assess, conflict/isolate, comeback/process, build tension, then reveal):
1. hook       - Declare the hook/problem. The viewer's pain or curiosity gap.
2. rising     - Rising action / assess. Stakes get clearer.
3. conflict   - Conflict / isolate. The tension sharpens.
4. comeback   - Comeback / process. The turnaround begins.
5. tension    - Build tension. Push toward the climax.
6. reveal     - Reveal. Payoff or twist.

IMPORTANT: Find EVERY moment in the video that matches one of these beats. A video might have 1 viable moment, or it might have 15. Do NOT cap the count at 6. If the video has 3 great hooks, return all 3. If it has 5 reveals, return all 5.

The transcript below includes timestamps in [HH:MM:SS,mmm --> HH:MM:SS,mmm] format. Use these timestamps for accurate sourceStart/sourceEnd values.

Return STRICT JSON: {"moments": [{"beat": "hook|rising|conflict|comeback|tension|reveal", "title": string, "rationale": string, "sourceStart": number, "sourceEnd": number}]}
- sourceStart/sourceEnd are seconds into the source video (use the timestamp data for accuracy).
- Each moment should be 15-60 seconds long.
- Return ALL viable moments — 1, 5, 10, 15, or however many the video contains. Do not artificially cap the count.
- Each moment should be a self-contained clip that makes sense on its own.
- No prose outside the JSON.`;

const HEADER_SYSTEM_PROMPT = `You write viral YouTube Shorts headers/captions.
Rules:
- Maximum 60 characters.
- Hook-driven, punchy, curiosity gap.
- No hashtags, no emojis.
- Title case.
Return STRICT JSON: {"header": string, "description": string}
Description is 1-2 sentences (max 200 chars) summarizing the short.`;

export function isZaiConfigured(): boolean {
  return getConfiguredProviders().length > 0;
}

export type ProviderStatus = {
  configured: ProviderName[];
  rotate: boolean;
};

export function getProviderStatus(): ProviderStatus {
  const configured = getConfiguredProviders();
  const rotate =
    configured.length >= 2 &&
    (process.env.LLM_ROTATE === undefined
      ? true
      : process.env.LLM_ROTATE === "true" ||
        process.env.LLM_ROTATE === "1" ||
        process.env.LLM_ROTATE === "yes");
  return { configured, rotate };
}

/**
 * Detect best moments in a transcript using the configured LLM provider(s),
 * with the user's 6-beat pattern.
 * Falls back to a deterministic split if no provider is configured.
 */
export async function detectMoments(
  transcript: string,
  totalDurationSec: number,
): Promise<DetectedMoment[]> {
  const configured = getConfiguredProviders();
  if (configured.length === 0 || !transcript || transcript.length < 50) {
    return fallbackMoments(totalDurationSec);
  }
  try {
    const { content } = await chatJson({
      system: SYSTEM_PROMPT,
      user: `Transcript:\n${transcript.slice(0, 12000)}\n\nTotal duration: ${totalDurationSec}s`,
      temperature: 0.6,
    });
    const parsed = JSON.parse(extractJson(content));
    const moments = (parsed.moments ?? [])
      .map((m: any) => normalizeMoment(m, totalDurationSec))
      .filter(Boolean) as DetectedMoment[];
    if (moments.length === 0) return fallbackMoments(totalDurationSec);
    return moments;
  } catch {
    return fallbackMoments(totalDurationSec);
  }
}

/**
 * Generate a viral header + description for a single detected moment.
 */
export async function generateShortHeader(moment: DetectedMoment): Promise<string> {
  const configured = getConfiguredProviders();
  const fallback = makeFallbackHeader(moment);
  if (configured.length === 0) return fallback;
  try {
    const { content } = await chatJson({
      system: HEADER_SYSTEM_PROMPT,
      user: `Beat: ${moment.beat}\nTitle: ${moment.title}\nRationale: ${moment.rationale}`,
      temperature: 0.9,
    });
    const parsed = JSON.parse(extractJson(content));
    const header = (parsed.header ?? "").toString().slice(0, 60);
    return header || fallback;
  } catch {
    return fallback;
  }
}

function makeFallbackHeader(moment: DetectedMoment): string {
  const prefixes: Record<NarrativeBeat, string> = {
    hook: "Wait — here's the problem",
    rising: "Why this matters more than you think",
    conflict: "The moment everything broke",
    comeback: "How it turned around",
    tension: "The turning point",
    reveal: "The thing nobody saw coming",
  };
  const base = prefixes[moment.beat] ?? "The moment";
  const suffix = moment.title.slice(0, 40);
  return `${base}: ${suffix}`.slice(0, 60);
}

function normalizeMoment(m: any, totalDurationSec: number): DetectedMoment | null {
  if (!m || typeof m !== "object") return null;
  const beat = BEAT_ORDER.includes(m.beat) ? (m.beat as NarrativeBeat) : "hook";
  const start = Math.max(0, Math.min(totalDurationSec, Number(m.sourceStart) || 0));
  const end = Math.max(start + 5, Math.min(totalDurationSec, Number(m.sourceEnd) || start + 30));
  return {
    beat,
    title: String(m.title || "Untitled moment").slice(0, 120),
    rationale: String(m.rationale || "").slice(0, 400),
    sourceStart: start,
    sourceEnd: end,
  };
}

function fallbackMoments(totalDurationSec: number): DetectedMoment[] {
  const seg = Math.max(15, Math.floor(totalDurationSec / 6));
  return BEAT_ORDER.map((beat, i) => ({
    beat,
    title: `Segment ${i + 1} — ${BEAT_LABELS[beat]}`,
    rationale: `Auto-segmented slice covering the ${BEAT_LABELS[beat].toLowerCase()} arc.`,
    sourceStart: i * seg,
    sourceEnd: Math.min(totalDurationSec, (i + 1) * seg),
  }));
}

function extractJson(content: string): string {
  // Tolerate code fences / preamble
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const first = content.indexOf("{");
  const last = content.lastIndexOf("}");
  if (first !== -1 && last !== -1) return content.slice(first, last + 1);
  return content;
}
