import { PrismaClient } from "@prisma/client";
import path from "path";
import { mkdirSync, existsSync } from "fs";

// Resolve the SQLite database path relative to the project root.
// This avoids issues with absolute paths from .env that might point to
// a different machine's filesystem (e.g. when cloning across machines).
function resolveDatabaseUrl(): string {
  const projectRoot = process.cwd();
  let url = process.env.DATABASE_URL;

  // If no DATABASE_URL is set, default to a relative path
  if (!url) {
    url = "file:./db/custom.db";
  }

  // If the path is absolute and doesn't match this machine's project root,
  // fall back to a relative path. This handles the case where someone
  // cloned the repo and their .env still has the old machine's path
  // (e.g. file:/home/z/my-project/db/custom.db on a Windows machine).
  if (url.startsWith("file:/")) {
    const dbPath = url.slice("file:".length);
    // Normalize both paths for comparison
    const normalizedDbPath = path.resolve(dbPath);
    const normalizedProjectRoot = path.resolve(projectRoot);
    if (!normalizedDbPath.startsWith(normalizedProjectRoot)) {
      url = "file:./db/custom.db";
    }
  }

  // Ensure the db directory exists
  if (url.startsWith("file:")) {
    const dbPath = url.slice("file:".length).replace(/^\.\//, "");
    const dir = path.dirname(dbPath);
    const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot, dir);
    if (!existsSync(fullDir)) {
      try {
        mkdirSync(fullDir, { recursive: true });
      } catch {
        // Directory creation might fail — Prisma will throw a clearer error
      }
    }
  }

  return url;
}

// Override DATABASE_URL at runtime so Prisma uses the resolved path.
// This must happen before the PrismaClient is instantiated.
const resolvedUrl = resolveDatabaseUrl();
if (process.env.DATABASE_URL !== resolvedUrl) {
  process.env.DATABASE_URL = resolvedUrl;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
