/**
 * Shared constants for the shorts narrative pattern.
 *
 * Each SHORT is a complete narrative arc containing all 6 beats:
 *   Hook → Rising → Conflict → Comeback → Tension → Reveal
 *
 * The LLM finds multiple arcs in the video. Each arc is assembled from
 * clips taken from DIFFERENT parts of the video (not a single continuous
 * cut), making each short a self-contained story.
 */

export type NarrativeBeat =
  | "hook"
  | "rising"
  | "conflict"
  | "comeback"
  | "tension"
  | "reveal";

export const BEAT_LABELS: Record<NarrativeBeat, string> = {
  hook: "Hook / Problem",
  rising: "Rising Action / Assess",
  conflict: "Conflict / Isolate",
  comeback: "Comeback / Process",
  tension: "Build Tension",
  reveal: "Reveal",
};

export const BEAT_ORDER: NarrativeBeat[] = [
  "hook",
  "rising",
  "conflict",
  "comeback",
  "tension",
  "reveal",
];

/** A single clip within a narrative arc (one beat). */
export type BeatClip = {
  beat: NarrativeBeat;
  /** Seconds in the source video */
  sourceStart: number;
  sourceEnd: number;
  /** The text spoken in this clip (for subtitles) */
  text: string;
};

/** A complete narrative arc — 6 clips forming a self-contained short. */
export type NarrativeArc = {
  id: string;
  title: string;
  header: string;
  clips: BeatClip[];
  /** Total duration after concatenation (seconds) */
  totalDuration: number;
};

/** Backward-compatible type (used by the old single-moment pipeline) */
export type DetectedMoment = {
  beat: NarrativeBeat;
  title: string;
  rationale: string;
  sourceStart: number;
  sourceEnd: number;
};

export type GeneratedShort = DetectedMoment & {
  header: string;
  description: string;
};
