import { PrismaClient } from "@prisma/client";
import path from "path";
import { mkdirSync, existsSync } from "fs";

/**
 * Resolve the SQLite database path to an ABSOLUTE path.
 *
 * Prisma resolves `file:./db/custom.db` relative to the `prisma/` directory
 * (where schema.prisma lives), NOT the project root. This means:
 *   - `prisma db push` creates the DB at `prisma/db/custom.db`
 *   - The runtime Prisma Client also looks at `prisma/db/custom.db`
 *
 * But our health check and setup scripts look at `project-root/db/custom.db`.
 * To make all three agree, we resolve the path to absolute here, relative to
 * the `prisma/` directory (matching Prisma's resolution).
 *
 * If the .env has an absolute path, we use it as-is.
 * If the .env has a relative path, we resolve it relative to the prisma/ dir.
 */
function resolveDatabaseUrl(): string {
  const projectRoot = process.cwd();
  const prismaDir = path.join(projectRoot, "prisma");
  let url = process.env.DATABASE_URL;

  // If no DATABASE_URL is set, default to a relative path
  if (!url) {
    url = "file:./db/custom.db";
  }

  // If the path is absolute and doesn't match this machine, fall back
  if (url.startsWith("file:/")) {
    const dbPath = url.slice("file:".length);
    const normalizedDbPath = path.resolve(dbPath);
    const normalizedProjectRoot = path.resolve(projectRoot);
    if (!normalizedDbPath.startsWith(normalizedProjectRoot)) {
      url = "file:./db/custom.db";
    }
  }

  // Resolve relative paths to absolute, relative to the prisma/ directory
  // (matching how Prisma resolves them)
  if (url.startsWith("file:") && !url.startsWith("file:///")) {
    let dbPath = url.slice("file:".length);

    // If it's a relative path (starts with ./ or ../ or doesn't start with /)
    if (!path.isAbsolute(dbPath)) {
      // Prisma resolves relative paths from the prisma/ directory
      dbPath = path.resolve(prismaDir, dbPath);
      url = `file:${dbPath}`;
    }
  }

  // Ensure the db directory exists
  if (url.startsWith("file:")) {
    const dbPath = url.slice("file:".length);
    const dir = path.dirname(dbPath);
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
      } catch {
        // Directory creation might fail — Prisma will throw a clearer error
      }
    }
  }

  return url;
}

// Override DATABASE_URL at runtime so Prisma uses the resolved absolute path.
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

/**
 * Export the resolved DB file path for the health check.
 */
export const dbFilePath = resolvedUrl.startsWith("file:")
  ? resolvedUrl.slice("file:".length)
  : "";
