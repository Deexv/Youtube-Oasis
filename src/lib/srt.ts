/**
 * SRT (SubRip Subtitle) parsing and manipulation.
 *
 * Used to:
 *   - Parse uploaded/pasted SRT files into structured segments
 *   - Extract the SRT lines that fall within a short's time range
 *   - Generate a sub-SRT file for a specific segment (for subtitle burning)
 */

export type SrtSegment = {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
};

/**
 * Parse an SRT file content into structured segments.
 * Tolerant of \r\n line endings, BOM, and missing blank lines.
 */
export function parseSRT(content: string): SrtSegment[] {
  // Strip BOM
  const clean = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = clean.split(/\n\s*\n/);
  const segments: SrtSegment[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n").filter(Boolean);
    if (lines.length < 2) continue;

    // First line might be the index number
    let idx = 0;
    let timeLineIdx = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      idx = parseInt(lines[0].trim(), 10) - 1;
      timeLineIdx = 1;
    }

    const timeMatch = lines[timeLineIdx]?.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/,
    );
    if (!timeMatch) continue;

    const start = parseSrtTime(timeMatch[1]);
    const end = parseSrtTime(timeMatch[2]);
    const text = lines.slice(timeLineIdx + 1).join("\n").trim();

    if (text) {
      segments.push({ index: idx, startSec: start, endSec: end, text });
    }
  }

  return segments;
}

/**
 * Parse a single SRT timestamp (HH:MM:SS,mmm or HH:MM:SS.mmm) into seconds.
 */
export function parseSrtTime(ts: string): number {
  const m = ts.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!m) return 0;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3]) + parseInt(m[4]) / 1000;
}

/**
 * Format seconds into an SRT timestamp: HH:MM:SS,mmm
 */
export function formatSrtTime(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/**
 * Extract the SRT segments that fall within [startSec, endSec].
 * Adjusts timestamps to be relative to startSec (so the sub-SRT starts at 00:00:00).
 */
export function extractSrtSegment(
  segments: SrtSegment[],
  startSec: number,
  endSec: number,
): SrtSegment[] {
  return segments
    .filter((s) => s.endSec > startSec && s.startSec < endSec)
    .map((s) => ({
      index: s.index,
      startSec: Math.max(0, s.startSec - startSec),
      endSec: Math.min(endSec - startSec, s.endSec - startSec),
      text: s.text,
    }));
}

/**
 * Generate an SRT file string from a list of segments.
 */
export function generateSRT(segments: SrtSegment[]): string {
  return segments
    .map((s, i) => {
      return `${i + 1}\n${formatSrtTime(s.startSec)} --> ${formatSrtTime(s.endSec)}\n${s.text}\n`;
    })
    .join("\n");
}

/**
 * Generate a plain-text transcript from SRT segments (for LLM analysis).
 * Includes timestamps so the LLM can pick moments with accurate timing.
 */
export function srtToTranscript(segments: SrtSegment[]): string {
  return segments
    .map((s) => `[${formatSrtTime(s.startSec)} --> ${formatSrtTime(s.endSec)}] ${s.text}`)
    .join("\n");
}
