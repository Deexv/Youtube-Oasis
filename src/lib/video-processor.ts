/**
 * Video processing pipeline using FFmpeg.
 *
 * For each detected moment, the pipeline:
 *   1. Cuts the segment from the source video
 *   2. Converts to vertical 9:16 (1080x1920) — crop + scale
 *   3. Burns viral-style subtitles (ASS format) with on/off toggle
 *   4. Overlays the title header text
 *
 * Requires ffmpeg + libass + libfreetype installed on the system.
 * On Ubuntu/Debian: apt install ffmpeg libass-dev libfreetype-dev
 * On macOS: brew install ffmpeg
 * On Windows: download from https://ffmpeg.org/download.html
 */

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { mkdir, writeFile, stat, unlink } from "fs/promises";
import { existsSync } from "fs";
import { generateSRT, type SrtSegment } from "@/lib/srt";
import type { BeatClip, NarrativeArc } from "@/lib/beats";

// Re-export client-safe types/constants
export { type SubtitleStyle, SUBTITLE_STYLES } from "@/lib/video-processor-shared";
import type { SubtitleStyle } from "@/lib/video-processor-shared";

const execFileAsync = promisify(execFile);

export type ProcessShortInput = {
  inputPath: string;
  outputPath: string;
  startSec: number;
  endSec: number;
  title: string;
  subtitleSegments: SrtSegment[];
  subtitleStyle: SubtitleStyle;
  subtitlesEnabled: boolean;
};

export type ProcessShortResult = {
  outputPath: string;
  duration: number;
  fileSize: number;
};

/**
 * Get video duration in seconds using ffprobe.
 */
export async function getVideoDuration(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    return parseFloat(stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

/**
 * Check if ffmpeg is available on the system.
 */
export async function isFFmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate an ASS subtitle file with the specified viral style.
 * ASS (Advanced SubStation Alpha) supports animations, colors, positioning.
 */
function generateASS(
  segments: SrtSegment[],
  style: SubtitleStyle,
  title: string,
): string {
  if (style === "none" || segments.length === 0) {
    return "";
  }

  const styles = getASSStyleConfig(style);

  // Header with style definitions
  // Add a "Title" style for the header overlay (used on Windows where
  // drawtext doesn't work — we embed the title as an ASS dialogue line)
  let ass = `[Script Info]
Title: ${title.replace(/[\n\r]/g, " ")}
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${styles.name},${styles.font},${styles.size},${styles.primaryColour},${styles.secondaryColour},${styles.outlineColour},${styles.backColour},${styles.bold},0,0,0,100,100,${styles.spacing},0,1,${styles.outline},${styles.shadow},2,80,80,${styles.marginV},1
Style: TitleStyle,Arial Black,56,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,2,0,1,4,2,8,80,80,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // On Windows, embed the title as the first ASS dialogue line (shown for 5 seconds)
  // since drawtext doesn't work there.
  const isWin = process.platform === "win32";
  if (isWin && title) {
    const titleEnd = Math.min(5, segments.length > 0 ? segments[segments.length - 1].endSec : 5);
    const titleText = title.replace(/[\n\r]/g, " ").slice(0, 50).replace(/\{/g, "").replace(/\}/g, "");
    ass += `Dialogue: 1,0:00:00.00,${assTime(titleEnd)},TitleStyle,,0,0,0,,${titleText}\n`;
  }

  // Dialogue lines
  for (const seg of segments) {
    const start = assTime(seg.startSec);
    const end = assTime(seg.endSec);
    // Escape special characters and add word-by-word effects if kinetic/bounce
    const text = formatASSText(seg.text, style);
    ass += `Dialogue: 0,${start},${end},${styles.name},,0,0,0,,${text}\n`;
  }

  return ass;
}

function getASSStyleConfig(style: SubtitleStyle) {
  const configs = {
    pop: {
      name: "Pop",
      font: "Arial Black",
      size: 72,
      primaryColour: "&H00FFFFFF", // white
      secondaryColour: "&H000000FF",
      outlineColour: "&H00000000", // black outline
      backColour: "&H80000000",
      bold: 1,
      spacing: 2,
      outline: 4,
      shadow: 2,
      marginV: 400,
    },
    bounce: {
      name: "Bounce",
      font: "Impact",
      size: 80,
      primaryColour: "&H00FFFF00", // yellow
      secondaryColour: "&H000000FF",
      outlineColour: "&H00000000",
      backColour: "&H80000000",
      bold: 1,
      spacing: 1,
      outline: 5,
      shadow: 3,
      marginV: 400,
    },
    neon: {
      name: "Neon",
      font: "Arial Black",
      size: 76,
      primaryColour: "&H00FF00FF", // magenta
      secondaryColour: "&H0000FF00",
      outlineColour: "&H00FF00FF",
      backColour: "&H00000000",
      bold: 1,
      spacing: 3,
      outline: 0,
      shadow: 8, // glow effect
      marginV: 400,
    },
    kinetic: {
      name: "Kinetic",
      font: "Arial Black",
      size: 96,
      primaryColour: "&H00FFFFFF",
      secondaryColour: "&H000000FF",
      outlineColour: "&H00000000",
      backColour: "&H80000000",
      bold: 1,
      spacing: 4,
      outline: 6,
      shadow: 2,
      marginV: 350,
    },
    fade: {
      name: "Fade",
      font: "Arial",
      size: 68,
      primaryColour: "&H00FFFFFF",
      secondaryColour: "&H000000FF",
      outlineColour: "&H00000000",
      backColour: "&H80000000",
      bold: 0,
      spacing: 0,
      outline: 3,
      shadow: 1,
      marginV: 400,
    },
    none: {
      name: "None",
      font: "Arial",
      size: 1,
      primaryColour: "&H00FFFFFF",
      secondaryColour: "&H000000FF",
      outlineColour: "&H00000000",
      backColour: "&H00000000",
      bold: 0,
      spacing: 0,
      outline: 0,
      shadow: 0,
      marginV: 0,
    },
  };
  return configs[style];
}

/**
 * Format text for ASS — handles word-by-word highlighting for kinetic/bounce.
 */
function formatASSText(text: string, style: SubtitleStyle): string {
  // Escape special ASS characters
  let escaped = text.replace(/\n/g, "\\N").replace(/\{/g, "\\{").replace(/\}/g, "\\}");

  if (style === "kinetic") {
    // Split into words and add color cycling
    const words = escaped.split(" ");
    const colors = ["&H00FFFFFF", "&H00FFFF00", "&H0000FF00", "&H00FF0000", "&H000000FF"];
    escaped = words
      .map((w, i) => `{\\c${colors[i % colors.length]}}${w}{\\c&H00FFFFFF}`)
      .join(" ");
  } else if (style === "bounce") {
    // Add bounce effect with \org and \move (simplified)
    const words = escaped.split(" ");
    escaped = words.map((w) => `{\\fad(100,50)}${w}`).join(" ");
  } else if (style === "pop") {
    // Pop-in animation
    escaped = `{\\fad(80,80)\\fscx100\\fscy100}${escaped}`;
  } else if (style === "neon") {
    // Glow is handled by shadow in the style
    escaped = `{\\fad(100,100)}${escaped}`;
  } else if (style === "fade") {
    escaped = `{\\fad(200,200)}${escaped}`;
  }

  return escaped;
}

/**
 * Convert seconds to ASS timestamp format: H:MM:SS.cc
 */
function assTime(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.floor(sec % 60);
  const cs = Math.floor((sec - Math.floor(sec)) * 100);
  return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/**
 * Escape text for FFmpeg drawtext filter.
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/%/g, "\\%")
    .replace(/,/g, "\\,")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}");
}

/**
 * Process a single short: cut, convert to vertical, burn subtitles, add title.
 *
 * This is a single FFmpeg command that does everything in one pass:
 *   - -ss / -to for segment extraction
 *   - crop + scale for 9:16 vertical
 *   - subtitles filter for ASS burning (if enabled)
 *   - drawtext for the title header overlay
 */
export async function processShort(input: ProcessShortInput): Promise<ProcessShortResult> {
  const { inputPath, outputPath, startSec, endSec, title, subtitleSegments, subtitleStyle, subtitlesEnabled } = input;

  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }

  // Build the filter chain
  const filters: string[] = [];

  // 1. Crop to 9:16 vertical — center crop based on input height
  //    crop=w=ih*9/16:h=ih  then scale to 1080x1920
  filters.push("crop=ih*9/16:ih");
  filters.push("scale=1080:1920:flags=lanczos");
  filters.push("setsar=1");

  // 2. Burn subtitles (if enabled and style is not "none")
  if (subtitlesEnabled && subtitleStyle !== "none" && subtitleSegments.length > 0) {
    const assPath = outputPath.replace(/\.[^.]+$/, ".ass");
    const assContent = generateASS(subtitleSegments, subtitleStyle, title);
    await writeFile(assPath, assContent, "utf-8");
    // Use the 'ass' filter instead of 'subtitles' — the 'ass' filter reads
    // ASS files directly and doesn't need fontconfig (which fails on Windows
    // with "Cannot load default config file").
    // On Windows: convert backslashes to forward slashes + escape the colon
    const isWin = process.platform === "win32";
    const filterPath = isWin
      ? assPath.replace(/\\/g, "/").replace(/:/g, "\\:")
      : assPath.replace(/:/g, "\\:");
    filters.push(`ass='${filterPath}'`);
  }

  // 3. Add title header at the top
  //    Skip on Windows — drawtext uses fontconfig which fails with
  //    "Cannot load default config file" even when the ass filter works.
  //    The title is still shown in the file name and the shorts list.
  const isWinDraw = process.platform === "win32";
  if (title && !isWinDraw) {
    const escapedTitle = escapeDrawtext(title.slice(0, 50));
    filters.push(
      `drawtext=text='${escapedTitle}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=60:box=1:boxcolor=black@0.5:boxborderw=10`,
    );
  }

  // 4. Add duration display at the bottom-right
  //    Skip on Windows (same fontconfig issue)
  const duration = endSec - startSec;
  const durationText = `${Math.round(duration)}s`;
  if (!isWinDraw) {
    filters.push(
      `drawtext=text='${durationText}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=36:fontcolor=white:borderw=2:bordercolor=black:x=w-text_w-20:y=h-text_h-20`,
    );
  }

  const filterComplex = filters.join(",");

  // Build the FFmpeg command
  // -ss before -i = fast seeking (doesn't decode from start)
  // -t = duration (more reliable than -to with seeking)
  const args = [
    "-y",
    "-ss", String(startSec),     // fast seek to start (before input)
    "-i", inputPath,             // input
    "-t", String(duration),      // take only N seconds
    "-vf", filterComplex,
    "-c:v", "libx264",
    "-preset", "ultrafast",      // fastest x264 preset
    "-crf", "30",                // lower quality = faster (shorts are short)
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "96k",               // lower audio bitrate (still fine for speech)
    "-ac", "1",                  // mono (speech doesn't need stereo)
    "-movflags", "+faststart",
    outputPath,
  ];

  try {
    // Don't use shell:true — execFile handles spaces in paths correctly
    // without shell mode. Shell mode on Windows splits args at spaces.
    const { stderr } = await execFileAsync("ffmpeg", args, {
      timeout: 300000,
      maxBuffer: 1024 * 1024 * 10,
      windowsHide: true,
    });

    // Verify the output file exists
    const fileStat = await stat(outputPath);
    return {
      outputPath,
      duration,
      fileSize: fileStat.size,
    };
  } catch (e: any) {
    const stderrTail = e?.stderr?.slice(-1000) || e?.message || "no stderr";
    throw new Error(`FFmpeg failed: ${stderrTail}`);
  }
}

// ─── ARC-BASED SHORT PROCESSING ────────────────────────────────────────

export type ProcessArcInput = {
  inputPath: string;
  outputPath: string;
  arc: NarrativeArc;
  subtitleStyle: SubtitleStyle;
  subtitlesEnabled: boolean;
};

export type ProcessArcResult = {
  outputPath: string;
  duration: number;
  fileSize: number;
};

/**
 * Process a complete narrative arc:
 *   1. Cut each clip from the source video (stream copy = fast)
 *   2. Concatenate all clips into one video
 *   3. Apply crop + scale (9:16) + subtitle burn + title overlay
 *
 * Each arc has 6 clips (hook → rising → conflict → comeback → tension → reveal)
 * taken from different parts of the video, merged into one 20-40s short.
 */
export async function processShortArc(input: ProcessArcInput): Promise<ProcessArcResult> {
  const { inputPath, outputPath, arc, subtitleStyle, subtitlesEnabled } = input;

  const outDir = path.dirname(outputPath);
  if (!existsSync(outDir)) {
    await mkdir(outDir, { recursive: true });
  }

  const isWin = process.platform === "win32";

  // Step 1: Cut each clip to a temp file (stream copy = no re-encode = fast)
  const tempFiles: string[] = [];
  let currentTimecode = 0; // running timecode in the merged video
  const clipTimings: Array<{ start: number; end: number; clip: BeatClip }> = [];

  for (let i = 0; i < arc.clips.length; i++) {
    const clip = arc.clips[i];
    const dur = clip.sourceEnd - clip.sourceStart;
    const tempFile = outputPath.replace(/\.mp4$/, `-clip-${i}.mp4`);

    const cutArgs = [
      "-y",
      "-ss", String(clip.sourceStart),
      "-i", inputPath,
      "-t", String(dur),
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      tempFile,
    ];

    try {
      await execFileAsync("ffmpeg", cutArgs, {
        timeout: 60000,
        maxBuffer: 1024 * 1024 * 10,
        windowsHide: true,
      });
      tempFiles.push(tempFile);
      clipTimings.push({ start: currentTimecode, end: currentTimecode + dur, clip });
      currentTimecode += dur;
    } catch (e: any) {
      // Clean up temp files
      for (const f of tempFiles) {
        try { await unlink(f); } catch {}
      }
      throw new Error(`Failed to cut clip ${i + 1} (${clip.beat}): ${e?.stderr?.slice(-300) || e?.message}`);
    }
  }

  // Step 2: Concatenate using the concat demuxer
  const concatListPath = outputPath.replace(/\.mp4$/, "-concat.txt");
  const concatContent = tempFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n");
  await writeFile(concatListPath, concatContent, "utf-8");

  const mergedFile = outputPath.replace(/\.mp4$/, "-merged.mp4");
  const concatArgs = [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concatListPath,
    "-c", "copy",
    mergedFile,
  ];

  try {
    await execFileAsync("ffmpeg", concatArgs, {
      timeout: 120000,
      maxBuffer: 1024 * 1024 * 10,
      windowsHide: true,
    });
  } catch (e: any) {
    for (const f of tempFiles) { try { await unlink(f); } catch {} }
    try { await unlink(concatListPath); } catch {}
    throw new Error(`Concat failed: ${e?.stderr?.slice(-300) || e?.message}`);
  }

  // Clean up temp clip files + concat list
  for (const f of tempFiles) { try { await unlink(f); } catch {} }
  try { await unlink(concatListPath); } catch {}

  // Step 3: Apply crop + scale + subtitles + title on the merged video
  const filters: string[] = [];
  filters.push("crop=ih*9/16:ih");
  filters.push("scale=1080:1920:flags=lanczos");
  filters.push("setsar=1");

  // Generate ASS subtitles with 4-5 word groups + white-background title
  if (subtitlesEnabled && subtitleStyle !== "none") {
    const assPath = outputPath.replace(/\.[^.]+$/, ".ass");
    const assContent = generateArcASS(arc, clipTimings, subtitleStyle);
    await writeFile(assPath, assContent, "utf-8");
    const filterPath = isWin
      ? assPath.replace(/\\/g, "/").replace(/:/g, "\\:")
      : assPath.replace(/:/g, "\\:");
    filters.push(`ass='${filterPath}'`);
  }

  // drawtext for duration (skip on Windows — fontconfig issue)
  const duration = currentTimecode;
  if (!isWin) {
    filters.push(
      `drawtext=text='${Math.round(duration)}s':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:fontsize=36:fontcolor=white:borderw=2:bordercolor=black:x=w-text_w-20:y=h-text_h-20`,
    );
  }

  const filterComplex = filters.join(",");

  const encodeArgs = [
    "-y",
    "-i", mergedFile,
    "-vf", filterComplex,
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "30",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "96k",
    "-ac", "1",
    "-movflags", "+faststart",
    outputPath,
  ];

  try {
    await execFileAsync("ffmpeg", encodeArgs, {
      timeout: 300000,
      maxBuffer: 1024 * 1024 * 10,
      windowsHide: true,
    });
    // Clean up merged file
    try { await unlink(mergedFile); } catch {}

    const fileStat = await stat(outputPath);
    return { outputPath, duration, fileSize: fileStat.size };
  } catch (e: any) {
    try { await unlink(mergedFile); } catch {}
    const stderrTail = e?.stderr?.slice(-1000) || e?.message || "no stderr";
    throw new Error(`FFmpeg encode failed: ${stderrTail}`);
  }
}

/**
 * Generate an ASS file for an arc.
 * - Title: white background, shown for first 5 seconds
 * - Subtitles: split into 4-5 word groups, each shown for ~1.5 seconds
 */
function generateArcASS(
  arc: NarrativeArc,
  clipTimings: Array<{ start: number; end: number; clip: BeatClip }>,
  style: SubtitleStyle,
): string {
  if (style === "none") return "";

  const styles = getASSStyleConfig(style);

  let ass = `[Script Info]
Title: ${arc.title.replace(/[\n\r]/g, " ")}
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${styles.name},${styles.font},${styles.size},${styles.primaryColour},${styles.secondaryColour},${styles.outlineColour},${styles.backColour},${styles.bold},0,0,0,100,100,${styles.spacing},0,1,${styles.outline},${styles.shadow},2,80,80,${styles.marginV},1
Style: TitleStyle,Arial Black,56,&H00000000,&H000000FF,&H00FFFFFF,&H00FFFFFF,1,0,0,0,100,100,2,0,1,4,0,8,60,60,80,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  // Title line — white background, black text, shown for 5 seconds at top
  const titleText = arc.header.replace(/[\n\r]/g, " ").slice(0, 50).replace(/\{/g, "").replace(/\}/g, "");
  const titleEnd = Math.min(5, arc.totalDuration);
  ass += `Dialogue: 1,0:00:00.00,${assTime(titleEnd)},TitleStyle,,0,0,0,,${titleText}\n`;

  // Subtitle lines — split each clip's text into 4-5 word groups
  for (const { start, end, clip } of clipTimings) {
    const words = clip.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    // Group into 4-5 word chunks
    const groupSize = words.length <= 5 ? words.length : 4;
    const groups: string[] = [];
    for (let i = 0; i < words.length; i += groupSize) {
      groups.push(words.slice(i, i + groupSize).join(" "));
    }

    const clipDur = end - start;
    const timePerGroup = clipDur / groups.length;

    for (let i = 0; i < groups.length; i++) {
      const segStart = start + i * timePerGroup;
      const segEnd = start + (i + 1) * timePerGroup;
      const text = groups[i].replace(/\{/g, "").replace(/\}/g, "");
      ass += `Dialogue: 0,${assTime(segStart)},${assTime(segEnd)},${styles.name},,0,0,0,,${text}\n`;
    }
  }

  return ass;
}

/**
 * Generate SRT from a video file using faster-whisper (Python).
 * Returns the path to the generated SRT file.
 *
 * On Windows, uses `python` instead of `python3` (which is the norm on Linux/macOS).
 */
export async function generateSRTViaWhisper(
  videoPath: string,
  outputPath: string,
  model: string = "base",
): Promise<string> {
  const scriptPath = path.join(process.cwd(), "scripts", "generate-srt.py");

  // Check if the script exists
  if (!existsSync(scriptPath)) {
    throw new Error(
      `SRT generation script not found at: ${scriptPath}\n` +
      `Run 'git pull' to get the latest code, then 'npm install' to ensure all files are present.`,
    );
  }

  // On Windows, `python3` usually doesn't exist — use `python` instead
  const isWindows = process.platform === "win32";
  const pythonCmd = isWindows ? "python" : "python3";

  // On Windows with shell:true, we must quote paths that contain spaces
  const quote = (s: string) => `"${s}"`;
  const pyArgs = isWindows
    ? [quote(scriptPath), quote(videoPath), quote(outputPath), model]
    : [scriptPath, videoPath, outputPath, model];

  try {
    const { stderr } = await execFileAsync(
      pythonCmd,
      pyArgs,
      {
        timeout: 600000,
        maxBuffer: 1024 * 1024 * 10,
        windowsHide: true,
        shell: isWindows,
      },
    );
    return outputPath;
  } catch (e: any) {
    // Provide a helpful error message
    let hint = "";
    if (e?.code === "ENOENT") {
      hint = `\nPython not found. Install Python 3 from https://python.org and make sure '${pythonCmd}' is in your PATH.`;
    } else if (e?.stderr?.includes("No module named 'faster_whisper'")) {
      hint = `\nfaster-whisper not installed. Run: pip install faster-whisper`;
    } else if (e?.stderr?.includes("No module named")) {
      hint = `\nMissing Python dependency. Run: pip install faster-whisper`;
    }
    throw new Error(
      `SRT generation failed: ${e?.message || "unknown error"}.${hint}\n${e?.stderr || ""}`,
    );
  }
}
