/**
 * ensure-db.mjs — Pre-flight check before running Prisma.
 *
 * Creates:
 *   1. The `db/` directory if it doesn't exist (Prisma on Windows sometimes
 *      fails to create the parent folder automatically).
 *   2. A default `.env` file with `DATABASE_URL=file:./db/custom.db` if no
 *      `.env` exists at all.
 *
 * This runs before `prisma generate` and `prisma db push` via the `predev`
 * and `db:push` npm scripts.
 */

import { mkdirSync, existsSync, writeFileSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

console.log("[ensure-db] Project root:", projectRoot);

// 1. Ensure the db/ directory exists
const dbDir = path.join(projectRoot, "db");
if (!existsSync(dbDir)) {
  try {
    mkdirSync(dbDir, { recursive: true });
    console.log("[ensure-db] Created db/ directory");
  } catch (e) {
    console.error("[ensure-db] Failed to create db/ directory:", e.message);
    process.exit(1);
  }
} else {
  console.log("[ensure-db] db/ directory exists");
}

// 2. Ensure .env exists with DATABASE_URL
const envPath = path.join(projectRoot, ".env");
const envExamplePath = path.join(projectRoot, ".env.example");

if (!existsSync(envPath)) {
  if (existsSync(envExamplePath)) {
    // Copy .env.example to .env
    const example = readFileSync(envExamplePath, "utf-8");
    writeFileSync(envPath, example, "utf-8");
    console.log("[ensure-db] Created .env from .env.example");
  } else {
    // Create a minimal .env
    const minimal = "DATABASE_URL=file:./db/custom.db\n";
    writeFileSync(envPath, minimal, "utf-8");
    console.log("[ensure-db] Created minimal .env with DATABASE_URL");
  }
} else {
  // .env exists — check if DATABASE_URL is set
  const envContent = readFileSync(envPath, "utf-8");
  if (!envContent.includes("DATABASE_URL=")) {
    // Append DATABASE_URL if missing
    const appended = envContent + "\nDATABASE_URL=file:./db/custom.db\n";
    writeFileSync(envPath, appended, "utf-8");
    console.log("[ensure-db] Appended DATABASE_URL to .env");
  } else {
    console.log("[ensure-db] .env exists with DATABASE_URL");
  }
}

// 3. Verify the DATABASE_URL points to a writable location
const envContent = readFileSync(envPath, "utf-8");
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
if (dbUrlMatch) {
  let dbUrl = dbUrlMatch[1].trim();
  console.log("[ensure-db] DATABASE_URL =", dbUrl);

  // If it's an absolute path that doesn't match the project root, warn
  if (dbUrl.startsWith("file:/") && !dbUrl.startsWith("file:./")) {
    const dbPath = dbUrl.slice("file:".length);
    const resolvedPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(projectRoot, dbPath);
    if (!resolvedPath.startsWith(projectRoot)) {
      console.warn("[ensure-db] WARNING: DATABASE_URL points outside the project root:");
      console.warn("[ensure-db]   " + dbUrl);
      console.warn("[ensure-db]   This may fail on a different machine.");
      console.warn("[ensure-db]   Consider changing it to: DATABASE_URL=file:./db/custom.db");
    }
  }
}

console.log("[ensure-db] ✓ Ready for Prisma");
