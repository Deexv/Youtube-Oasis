/**
 * Client-safe constants for subtitle styles.
 * Kept separate from video-processor.ts so client components can import
 * the labels without pulling in the Node-only ffmpeg child_process imports.
 */

export type SubtitleStyle = "pop" | "bounce" | "neon" | "kinetic" | "fade" | "none";

export const SUBTITLE_STYLES: { value: SubtitleStyle; label: string; description: string }[] = [
  { value: "pop", label: "Pop", description: "Bold white text, black outline, pop-in" },
  { value: "bounce", label: "Bounce", description: "Word-by-word bounce entry" },
  { value: "neon", label: "Neon", description: "Glowing neon effect" },
  { value: "kinetic", label: "Kinetic", description: "Large kinetic typography, word by word" },
  { value: "fade", label: "Fade", description: "Simple fade in/out" },
  { value: "none", label: "None", description: "No burned subtitles" },
];
