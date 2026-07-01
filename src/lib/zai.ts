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
import { BEAT_LABELS, BEAT_ORDER, type NarrativeBeat, type DetectedMoment, type BeatClip, type NarrativeArc } from "@/lib/beats";
import { chatJson, getConfiguredProviders, type ProviderName } from "@/lib/llm";

const SYSTEM_PROMPT = `You are a viral short-form video editor who creates COMPLETE, COHERENT narrative shorts from long-form video transcripts.

Each SHORT must be a self-contained story that follows this EXACT 6-beat narrative arc IN ORDER:
1. hook       - Declare the hook/problem. The viewer's pain or curiosity gap.
2. rising     - Rising action / assess. Stakes get clearer.
3. conflict   - Conflict / isolate. The tension sharpens.
4. comeback   - Comeback / process. The turnaround begins.
5. tension    - Build tension. Push toward the climax.
6. reveal     - Reveal. Payoff or twist.

CRITICAL RULES FOR COHERENCE:
- Each clip MUST start at the beginning of a sentence or clause and end at the end of one. NEVER cut mid-word or mid-sentence. Use the SRT segment timestamps as boundaries.
- The 6 clips together must tell a COMPLETE story that makes sense on its own. A viewer who hasn't seen the original video should understand the narrative.
- The clips must flow logically — each beat should naturally lead to the next. If a clip from timestamp 5:30 follows a clip from 1:20, the viewer should feel a smooth transition.
- Pick clips where the speaker COMPLETES their thought within the clip. Don't end on a cliffhanger mid-sentence.
- Each clip should be 3-8 seconds. The total short should be 20-45 seconds.
- Find as many complete arcs as the video supports (1, 2, 3 — however many good stories the video contains). Quality over quantity. Do NOT create arcs that don't make sense.

The transcript below includes timestamps in [HH:MM:SS,mmm --> HH:MM:SS,mmm] format. Each bracketed segment is one SRT entry. Use these exact timestamps as clip boundaries.

Return STRICT JSON:
{
  "arcs": [
    {
      "title": "short title",
      "header": "viral header (max 60 chars)",
      "clips": [
        {"beat": "hook", "sourceStart": number, "sourceEnd": number, "text": "exact words spoken"},
        {"beat": "rising", "sourceStart": number, "sourceEnd": number, "text": "exact words spoken"},
        {"beat": "conflict", "sourceStart": number, "sourceEnd": number, "text": "exact words spoken"},
        {"beat": "comeback", "sourceStart": number, "sourceEnd": number, "text": "exact words spoken"},
        {"beat": "tension", "sourceStart": number, "sourceEnd": number, "text": "exact words spoken"},
        {"beat": "reveal", "sourceStart": number, "sourceEnd": number, "text": "exact words spoken"}
      ]
    }
  ]
}
- sourceStart/sourceEnd are seconds into the source video (from the SRT timestamps).
- Each clip MUST be 3-8 seconds.
- Total duration of all 6 clips MUST be 20-45 seconds.
- "text" is the EXACT words spoken in that clip (for subtitles).
- ONLY return arcs where all 6 beats are present and the story makes complete sense.
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

export type ArcDetectionResult = {
  arcs: NarrativeArc[];
  provider: ProviderName | "fallback";
  error?: string;
};

export type DetectionResult = {
  moments: DetectedMoment[];
  provider: ProviderName | "fallback";
  error?: string;
};

/**
 * Detect complete narrative arcs in a transcript.
 * Each arc = 6 clips (hook → rising → conflict → comeback → tension → reveal)
 * assembled from different parts of the video.
 */
export async function detectArcsWithStatus(
  transcript: string,
  totalDurationSec: number,
): Promise<ArcDetectionResult> {
  const configured = getConfiguredProviders();
  if (configured.length === 0) {
    return {
      arcs: fallbackArcs(totalDurationSec),
      provider: "fallback",
      error: "No LLM provider configured. Set at least one API key in .env (ZAI_API_KEY, GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY).",
    };
  }
  if (!transcript || transcript.length < 50) {
    return {
      arcs: fallbackArcs(totalDurationSec),
      provider: "fallback",
      error: "Transcript too short for LLM analysis (< 50 chars).",
    };
  }
  try {
    const { content, provider } = await chatJson({
      system: SYSTEM_PROMPT,
      user: `Transcript:\n${transcript.slice(0, 12000)}\n\nTotal duration: ${totalDurationSec}s`,
      temperature: 0.6,
    });
    const parsed = JSON.parse(extractJson(content));
    const arcs = (parsed.arcs ?? [])
      .map((a: any) => normalizeArc(a, totalDurationSec))
      .filter(Boolean) as NarrativeArc[];
    if (arcs.length === 0) {
      return {
        arcs: fallbackArcs(totalDurationSec),
        provider: "fallback",
        error: `LLM (${provider}) returned 0 arcs. Using fallback.`,
      };
    }
    return { arcs, provider };
  } catch (e: any) {
    return {
      arcs: fallbackArcs(totalDurationSec),
      provider: "fallback",
      error: `LLM call failed: ${e?.message || "unknown error"}. Using fallback.`,
    };
  }
}

function normalizeArc(a: any, totalDurationSec: number): NarrativeArc | null {
  if (!a || !Array.isArray(a.clips) || a.clips.length < 3) return null;
  const clips: BeatClip[] = a.clips
    .map((c: any) => {
      if (!c || !BEAT_ORDER.includes(c.beat)) return null;
      let start = Math.max(0, Math.min(totalDurationSec, Number(c.sourceStart) || 0));
      let end = Math.max(start + 2, Math.min(totalDurationSec, Number(c.sourceEnd) || start + 5));
      // Clamp to 2-10 seconds per clip (more lenient for natural sentence boundaries)
      const dur = end - start;
      if (dur > 10) end = start + 10;
      if (dur < 2) end = Math.min(totalDurationSec, start + 2);
      return {
        beat: c.beat as NarrativeBeat,
        sourceStart: start,
        sourceEnd: end,
        text: String(c.text || "").slice(0, 300),
      };
    })
    .filter(Boolean) as BeatClip[];
  if (clips.length < 3) return null;
  const totalDuration = clips.reduce((sum, c) => sum + (c.sourceEnd - c.sourceStart), 0);
  // More lenient: 12-60 seconds total
  if (totalDuration < 12 || totalDuration > 60) return null;
  return {
    id: `arc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: String(a.title || "Untitled short").slice(0, 120),
    header: String(a.header || a.title || "").slice(0, 60),
    clips,
    totalDuration,
  };
}

function fallbackArcs(totalDurationSec: number): NarrativeArc[] {
  // Create 1-3 simple arcs with 30-second total duration
  const count = Math.min(3, Math.max(1, Math.floor(totalDurationSec / 120)));
  return Array.from({ length: count }, (_, i) => {
    const offset = i * Math.floor(totalDurationSec / count);
    const clipDur = 5; // 5 seconds per clip × 6 clips = 30s total
    const clips: BeatClip[] = BEAT_ORDER.map((beat, j) => {
      const start = Math.min(totalDurationSec - clipDur, offset + j * clipDur);
      return {
        beat,
        sourceStart: start,
        sourceEnd: Math.min(totalDurationSec, start + clipDur),
        text: `Segment ${j + 1} — ${BEAT_LABELS[beat]}`,
      };
    });
    return {
      id: `fallback-arc-${i}`,
      title: `Short ${i + 1}`,
      header: `Short ${i + 1}`,
      clips,
      totalDuration: clipDur * BEAT_ORDER.length,
    };
  });
}

/**
 * Backward-compatible: detect individual moments (old pipeline).
 * Prefer detectArcsWithStatus() for the new arc-based pipeline.
 */
export async function detectMomentsWithStatus(
  transcript: string,
  totalDurationSec: number,
): Promise<DetectionResult> {
  const configured = getConfiguredProviders();
  if (configured.length === 0) {
    return {
      moments: fallbackMoments(totalDurationSec),
      provider: "fallback",
      error: "No LLM provider configured.",
    };
  }
  if (!transcript || transcript.length < 50) {
    return {
      moments: fallbackMoments(totalDurationSec),
      provider: "fallback",
      error: "Transcript too short for LLM analysis.",
    };
  }
  try {
    const { content, provider } = await chatJson({
      system: SYSTEM_PROMPT,
      user: `Transcript:\n${transcript.slice(0, 12000)}\n\nTotal duration: ${totalDurationSec}s`,
      temperature: 0.6,
    });
    const parsed = JSON.parse(extractJson(content));
    // Try arcs format first, fall back to moments
    if (parsed.arcs) {
      const arcs = (parsed.arcs ?? [])
        .map((a: any) => normalizeArc(a, totalDurationSec))
        .filter(Boolean) as NarrativeArc[];
      const moments: DetectedMoment[] = arcs.flatMap((a) =>
        a.clips.map((c) => ({
          beat: c.beat,
          title: a.title,
          rationale: a.header,
          sourceStart: c.sourceStart,
          sourceEnd: c.sourceEnd,
        })),
      );
      return { moments, provider };
    }
    const moments = (parsed.moments ?? [])
      .map((m: any) => normalizeMoment(m, totalDurationSec))
      .filter(Boolean) as DetectedMoment[];
    if (moments.length === 0) {
      return {
        moments: fallbackMoments(totalDurationSec),
        provider: "fallback",
        error: `LLM (${provider}) returned 0 results. Using fallback.`,
      };
    }
    return { moments, provider };
  } catch (e: any) {
    return {
      moments: fallbackMoments(totalDurationSec),
      provider: "fallback",
      error: `LLM call failed: ${e?.message || "unknown error"}. Using fallback.`,
    };
  }
}

/**
 * Backward-compatible version — returns just the moments array.
 * Prefer detectMomentsWithStatus() to know if the LLM was actually used.
 */
export async function detectMoments(
  transcript: string,
  totalDurationSec: number,
): Promise<DetectedMoment[]> {
  const result = await detectMomentsWithStatus(transcript, totalDurationSec);
  if (result.error) {
    console.warn(`[detectMoments] ${result.error}`);
  }
  return result.moments;
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
  let start = Math.max(0, Math.min(totalDurationSec, Number(m.sourceStart) || 0));
  let end = Math.max(start + 5, Math.min(totalDurationSec, Number(m.sourceEnd) || start + 30));

  // Enforce 20-40 second shorts
  const dur = end - start;
  if (dur < 20) {
    // Too short — extend to 20 seconds
    end = Math.min(totalDurationSec, start + 20);
  } else if (dur > 40) {
    // Too long — trim to 40 seconds
    end = start + 40;
  }

  return {
    beat,
    title: String(m.title || "Untitled moment").slice(0, 120),
    rationale: String(m.rationale || "").slice(0, 400),
    sourceStart: start,
    sourceEnd: end,
  };
}

function fallbackMoments(totalDurationSec: number): DetectedMoment[] {
  // Fallback: 30-second shorts spread across the video
  const shortDur = 30; // 30 seconds each (within the 20-40 range)
  const count = Math.min(6, Math.max(1, Math.floor(totalDurationSec / 60)));
  const spacing = Math.floor((totalDurationSec - shortDur) / Math.max(1, count - 1));
  return Array.from({ length: count }, (_, i) => {
    const beat = BEAT_ORDER[i % BEAT_ORDER.length];
    const start = i * spacing;
    const end = Math.min(totalDurationSec, start + shortDur);
    return {
      beat,
      title: `Segment ${i + 1} — ${BEAT_LABELS[beat]}`,
      rationale: `Auto-segmented slice covering the ${BEAT_LABELS[beat].toLowerCase()} arc.`,
      sourceStart: start,
      sourceEnd: end,
    };
  });
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
