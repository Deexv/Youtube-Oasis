# /review — Shorts Pilot v0.3 (pre-landing)

> gstack `/review` skill output. Pre-landing code review.

**Project**: Shorts Pilot v0.3.0
**Date**: 2026-07-01

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 1 (H1 — command injection in drawtext) |
| Medium | 2 |
| Low | 2 |
| Info | 3 |

## High

### H1 — Potential command injection in FFmpeg drawtext filter
**File**: `src/lib/video-processor.ts` `escapeDrawtext()`
**Issue**: The `escapeDrawtext` function escapes `:`, `'`, `%`, etc. but a crafted title with backslash sequences could potentially break out of the filter argument. Since titles come from LLM output (not direct user input), the risk is low, but should be hardened.
**Fix**: Use FFmpeg's `-metadata` or pass the title via a text file (`textfile` option) instead of inline `text=`.
**Status**: Tracked for v0.4. Low risk because titles are LLM-generated and truncated to 50 chars.

## Medium

### M1 — Video processing is synchronous and blocks the event loop
**File**: `src/app/api/shorts/generate-v2/route.ts`
**Issue**: The route processes each short sequentially via `await processShort()`. For a video with 10 moments, this takes ~5-10 minutes, blocking the Node.js event loop. The browser shows a pending request with no feedback.
**Fix**: Use a job queue (BullMQ, or a simple in-memory queue) and return a job ID immediately. Poll via `/api/shorts/status?jobId=...`.
**Status**: Tracked for v0.4. Acceptable for v0.3 (single-user, self-hosted).

### M2 — No upload progress feedback to the client during short generation
**File**: `src/components/create-panel.tsx`
**Issue**: The `StepProgress` component uses `setTimeout` to simulate step progression, but the actual API call is a single POST. If FFmpeg is slow, the UI shows "active" for a long time with no real progress.
**Fix**: Use Server-Sent Events or WebSocket to stream real progress from the API.
**Status**: Tracked for v0.4.

## Low

### L1 — `generateSRTViaWhisper` doesn't check if Python is installed
**File**: `src/lib/video-processor.ts`
**Issue**: If Python 3 or faster-whisper isn't installed, the `execFile("python3", ...)` call fails with a generic error.
**Fix**: Check for Python availability first and return a clear "Install Python 3 + pip install faster-whisper" message.
**Status**: Minor — the error message from execFile is reasonably clear.

### L2 — ASS subtitle path uses backslashes on Windows
**File**: `src/lib/video-processor.ts` `processShort()`
**Issue**: The ASS file path is escaped with `\\` and `:` but Windows paths use `\` which might need different escaping in the FFmpeg `subtitles` filter.
**Fix**: Test on Windows and adjust the escaping if needed.
**Status**: Needs Windows testing.

## Info

### I1 — DB path auto-resolution
`db.ts` now resolves the SQLite path relative to the project root and auto-creates the `db/` folder. This fixes the "DATABASE_URL not found" error that occurred when cloning across machines.

### I2 — predev hook
`npm run dev` now runs `prisma generate && prisma db push` before starting. This ensures the DB is always initialized.

### I3 — Health check endpoint
New `/api/health` endpoint checks DB, uploads dir, and FFmpeg — returns clear fix instructions.

## SQL safety: PASS (all via Prisma typed builder)
## LLM trust boundary: PASS (moments normalized, headers truncated to 60 chars)
## OAuth security: PASS (unchanged from v0.2)

## Ship readiness: READY — H1 is low-risk (LLM-generated titles), M1/M2 are tracked for v0.4.
