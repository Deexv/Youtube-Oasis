/**
 * postinstall.mjs — Runs after `npm install` to install Python dependencies.
 *
 * Installs faster-whisper (for SRT auto-generation via Whisper).
 * If Python or pip is not available, prints a warning but doesn't fail
 * (the app still works — users can paste SRT manually).
 */

import { spawnSync } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

function log(msg) {
  console.log(`[postinstall] ${msg}`);
}

function warn(msg) {
  console.warn(`[postinstall] WARNING: ${msg}`);
}

// Check if this is a local install (not a global/CI install)
const isLocalInstall = existsSync(path.join(projectRoot, "package.json"));
if (!isLocalInstall) {
  log("Skipping Python setup (not a local install)");
  process.exit(0);
}

// Don't run during npm install on CI/production unless explicitly needed
if (process.env.CI === "true" || process.env.NODE_ENV === "production") {
  log("Skipping Python setup (CI/production environment)");
  process.exit(0);
}

log("Installing Python dependencies for SRT auto-generation...");

// Try to find Python + pip
const pythonCmds = isWindows ? ["python", "py"] : ["python3", "python"];
let foundPython = false;

for (const cmd of pythonCmds) {
  const result = spawnSync(cmd, ["--version"], {
    stdio: "pipe",
    shell: isWindows,
    windowsHide: true,
  });

  if (result.status === 0) {
    const version = result.stdout.toString().trim();
    log(`Found ${cmd}: ${version}`);

    // Try to install faster-whisper
    log("Installing faster-whisper via pip...");
    const pipResult = spawnSync(
      cmd,
      ["-m", "pip", "install", "faster-whisper"],
      {
        cwd: projectRoot,
        stdio: "inherit",
        shell: isWindows,
        windowsHide: true,
      },
    );

    if (pipResult.status === 0) {
      log("✓ faster-whisper installed successfully");
      log("✓ You can now auto-generate SRT files via Whisper");
      foundPython = true;
      break;
    } else {
      warn(`pip install failed for ${cmd}. SRT auto-generation will not work.`);
      warn("You can still paste SRT files manually in the Create tab.");
      warn("To fix: install Python 3 from https://python.org and run: pip install faster-whisper");
      foundPython = true; // Python was found, just pip failed
      break;
    }
  }
}

if (!foundPython) {
  warn("Python 3 not found on PATH. SRT auto-generation will not work.");
  warn("The app still works — you can paste SRT files manually.");
  warn("To enable auto-generation:");
  warn("  1. Install Python 3 from https://python.org");
  warn("  2. Run: pip install faster-whisper");
}

// Don't fail the npm install even if Python setup fails
process.exit(0);
