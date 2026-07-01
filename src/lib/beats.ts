/**
 * Shared constants for the shorts narrative pattern.
 * Kept in a separate file from `zai.ts` so it can be imported by client
 * components without pulling in the Node-only `z-ai-web-dev-sdk`.
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

export type DetectedMoment = {
  beat: NarrativeBeat;
  title: string;
  rationale: string;
  sourceStart: number; // seconds in source
  sourceEnd: number; // seconds in source
};

export type GeneratedShort = DetectedMoment & {
  header: string; // viral-style caption / on-screen text
  description: string;
};
