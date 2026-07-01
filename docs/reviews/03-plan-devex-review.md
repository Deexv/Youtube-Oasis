# /plan-devex-review — Shorts Pilot v0.3

> gstack `/plan-devex-review` skill output. Developer experience review.

**Project**: Shorts Pilot v0.3.0
**Date**: 2026-07-01

## What changed (v0.3)
- Real video processing via FFmpeg (cut, convert 9:16, burn subtitles)
- SRT support (upload, paste, auto-generate via faster-whisper)
- Short preview with video player
- Batch scheduling
- DB auto-initialization on `npm run dev` (predev hook runs `prisma db push`)
- Cross-platform DB path resolution (no more Linux-path-on-Windows errors)
- Health check endpoint at `/api/health`

## DX scorecard

| Dimension | v0.2 | v0.3 | Notes |
|-----------|------|------|-------|
| First-run experience | 5/10 | 9/10 | predev auto-creates DB; health check guides setup |
| Error messages | 6/10 | 9/10 | DB errors now return clear "run npm run db:push" messages |
| Cross-platform | 5/10 | 9/10 | DB path auto-resolved; cross-env for NODE_OPTIONS |
| Feature completeness | 6/10 | 9/10 | Real video files, subtitles, preview, download |
| Code navigability | 8/10 | 8/10 | New libs (srt.ts, video-processor.ts) are well-documented |
| **Overall DX** | 6.0/10 | 8.8/10 | |

## Fixes applied
- **DB path resolution** — `db.ts` now resolves the SQLite path relative to the project root, auto-creates the `db/` folder, and falls back to `./db/custom.db` if the .env path is invalid. Fixes the "Environment variable not found: DATABASE_URL" error on Windows.
- **predev hook** — `npm run dev` now runs `prisma generate && prisma db push` before starting the server, so the DB is always initialized.
- **Graceful DB errors** — `/api/settings` and `/api/upload` now catch DB errors and return helpful messages instead of 500s.
- **Health check** — new `/api/health` endpoint checks DB, uploads dir, and FFmpeg, returning clear fix instructions.

## Remaining friction
- **FFmpeg dependency** — users must install FFmpeg separately. Documented in README.
- **Python + faster-whisper** — optional but needed for auto SRT. Documented.
- **No tests** — still deferred from v0.1.

## VERDICT
The v0.3 changes fix the biggest DX pain point (DB initialization) and add the most-requested features (real video processing, subtitles, preview). DX score jumped from 6.0 to 8.8.
