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
import { mkdir, writeFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { generateSRT, type SrtSegment } from "@/lib/srt";

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
  let ass = `[Script Info]
Title: ${title.replace(/[\n\r]/g, " ")}
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ${styles.name},${styles.font},${styles.size},${styles.primaryColour},${styles.secondaryColour},${styles.outlineColour},${styles.backColour},${styles.bold},0,0,0,100,100,${styles.spacing},0,1,${styles.outline},${styles.shadow},2,80,80,${styles.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

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
    // Write the ASS file
    const assPath = outputPath.replace(/\.[^.]+$/, ".ass");
    const assContent = generateASS(subtitleSegments, subtitleStyle, title);
    await writeFile(assPath, assContent, "utf-8");
    // Escape the path for the filter
    const escapedAssPath = assPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:");
    filters.push(`subtitles='${escapedAssPath}'`);
  }

  // 3. Add title header at the top (skip the fontfile on Windows — FFmpeg
  //    uses the system default font, which is fine)
  if (title) {
    const escapedTitle = escapeDrawtext(title.slice(0, 50));
    const isWin = process.platform === "win32";
    const fontfileParam = isWin
      ? "" // Windows: use system default font
      : ":fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
    filters.push(
      `drawtext=text='${escapedTitle}'${fontfileParam}:fontsize=48:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=60:box=1:boxcolor=black@0.5:boxborderw=10`,
    );
  }

  // 4. Add duration display at the bottom-right
  const duration = endSec - startSec;
  const durationText = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, "0")}`;
  const isWin2 = process.platform === "win32";
  const durFontfile = isWin2 ? "" : ":fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  filters.push(
    `drawtext=text='${durationText}'${durFontfile}:fontsize=36:fontcolor=white:borderw=2:bordercolor=black:x=w-text_w-20:y=h-text_h-20`,
  );

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
