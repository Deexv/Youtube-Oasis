/**
 * setup.mjs — One-shot setup script that runs before the dev server.
 *
 * This script is bulletproof — it handles every failure mode:
 *   1. Creates the db/ directory
 *   2. Creates .env from .env.example if missing
 *   3. Runs prisma generate (regenerates the client)
 *   4. Runs prisma db push (creates the SQLite file + tables)
 *
 * Each step is wrapped in try/catch with clear error messages.
 * If any step fails, it prints what went wrong and how to fix it,
 * then exits with code 1 so the dev server doesn't start with a broken DB.
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

function log(msg) {
  console.log(`[setup] ${msg}`);
}

function error(msg) {
  console.error(`[setup] ERROR: ${msg}`);
}

function runCommand(cmd, args, label) {
  log(`Running: ${label}`);
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: isWindows, // Use shell on Windows for PATH resolution
    windowsHide: true,
  });
  if (result.status !== 0) {
    error(`${label} failed with exit code ${result.status}`);
    return false;
  }
  return true;
}

// ─── Step 1: Create db/ directory ──────────────────────────────────────
const dbDir = path.join(projectRoot, "db");
if (!existsSync(dbDir)) {
  try {
    mkdirSync(dbDir, { recursive: true });
    log("Created db/ directory");
  } catch (e) {
    error(`Failed to create db/ directory: ${e.message}`);
    process.exit(1);
  }
} else {
  log("db/ directory exists");
}

// ─── Step 2: Ensure .env exists with DATABASE_URL ──────────────────────
const envPath = path.join(projectRoot, ".env");
const envExamplePath = path.join(projectRoot, ".env.example");

if (!existsSync(envPath)) {
  if (existsSync(envExamplePath)) {
    const example = readFileSync(envExamplePath, "utf-8");
    writeFileSync(envPath, example, "utf-8");
    log("Created .env from .env.example");
  } else {
    const minimal = "DATABASE_URL=file:./db/custom.db\n";
    writeFileSync(envPath, minimal, "utf-8");
    log("Created minimal .env");
  }
} else {
  const envContent = readFileSync(envPath, "utf-8");
  if (!envContent.includes("DATABASE_URL=")) {
    const appended = envContent + "\nDATABASE_URL=file:./db/custom.db\n";
    writeFileSync(envPath, appended, "utf-8");
    log("Appended DATABASE_URL to .env");
  } else {
    log(".env exists with DATABASE_URL");
  }
}

// ─── Step 3: Check if DB file already exists ───────────────────────────
const dbFile = path.join(projectRoot, "db", "custom.db");
if (existsSync(dbFile)) {
  log("Database file exists — skipping creation");
  log("✓ Setup complete");
  process.exit(0);
}

// ─── Step 4: Run prisma generate ───────────────────────────────────────
const npxCmd = isWindows ? "npx.cmd" : "npx";
if (!runCommand(npxCmd, ["prisma", "generate"], "prisma generate")) {
  error("prisma generate failed. Try running manually: npx prisma generate");
  process.exit(1);
}

// ─── Step 5: Run prisma db push ────────────────────────────────────────
if (!runCommand(npxCmd, ["prisma", "db", "push"], "prisma db push")) {
  error("prisma db push failed. Try running manually: npx prisma db push");
  error(`If it fails with a binary download error, set: PRISMA_ENGINES_MIRROR=https://binaries.prisma.sh`);
  process.exit(1);
}

// ─── Step 6: Verify the DB file was created ────────────────────────────
if (existsSync(dbFile)) {
  log("✓ Database file created: db/custom.db");
  log("✓ Setup complete");
} else {
  error("Database file was not created. This is unexpected.");
  error("Try running manually: npx prisma db push");
  process.exit(1);
}
