import { PrismaClient } from "@prisma/client";
import path from "path";
import { mkdirSync, existsSync } from "fs";

// Resolve the SQLite database path relative to the project root.
// This avoids issues with absolute paths from .env that might point to
// a different machine's filesystem (e.g. when cloning across machines).
function resolveDatabaseUrl(): string {
  let url = process.env.DATABASE_URL;

  // If no DATABASE_URL is set, or if it points to a path that doesn't
  // exist on this machine, fall back to a relative path in ./db/
  if (!url) {
    url = "file:./db/custom.db";
  }

  // If the path is absolute and doesn't start with the project root,
  // convert it to a relative path. This handles the case where someone
  // cloned the repo and their .env still has the old machine's path.
  if (url.startsWith("file:/")) {
    // Extract the path part (after "file:")
    const dbPath = url.slice("file:".length);
    // If it's not under the current project directory, use a relative path
    const projectRoot = process.cwd();
    if (!dbPath.startsWith(projectRoot) && !dbPath.startsWith("./") && !dbPath.startsWith("../")) {
      url = "file:./db/custom.db";
    }
  }

  // Ensure the db directory exists
  if (url.startsWith("file:")) {
    const dbPath = url.slice("file:".length);
    const dir = path.dirname(dbPath.replace(/^\.\//, ""));
    const fullDir = path.isAbsolute(dir) ? dir : path.join(projectRoot ?? process.cwd(), dir);
    if (!existsSync(fullDir)) {
      try {
        mkdirSync(fullDir, { recursive: true });
      } catch {
        // Directory creation might fail if the path is invalid — Prisma will
        // throw a more useful error when it tries to connect.
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
