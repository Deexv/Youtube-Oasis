# /document-release — Shorts Pilot v0.3.0

> gstack `/document-release` skill output. Post-ship documentation update.

**Project**: Shorts Pilot
**Version**: 0.3.0
**Date**: 2026-07-01

## What shipped (v0.3.0)

### The shorts pipeline is now real
- **FFmpeg video processing** — each short is cut from the source video, converted to 9:16 vertical (1080x1920), and saved as a real MP4 file.
- **Viral subtitle burning** — 5 styles (Pop, Bounce, Neon, Kinetic, Fade) via ASS subtitles + FFmpeg. On/off toggle.
- **In-video title header** — viral header text overlaid at the top + duration at the bottom-right.
- **SRT support** — upload, paste, or auto-generate via faster-whisper (CPU-based, low-spec friendly).
- **Preview** — video player in the browser for every generated short.
- **Download** — individual or all at once.
- **Batch scheduling** — select which shorts to schedule, then schedule with proper 2-hour spacing.
- **Dynamic short count** — the LLM finds ALL viable moments (1-15+), not capped at 6.

### Reliability fixes
- **DB auto-initialization** — `npm run dev` now runs `prisma db push` automatically. No more "DATABASE_URL not found" errors.
- **Cross-platform DB path** — the SQLite path is resolved relative to the project root, so cloning across machines works.
- **Graceful DB errors** — API routes return helpful messages instead of 500s when the DB isn't ready.
- **Health check endpoint** — `/api/health` checks DB, uploads dir, and FFmpeg.

## Sell-test rubric (CHANGELOG)

| Entry | Sell-test | Pass? |
|-------|-----------|-------|
| "FFmpeg-powered short creation" | Yes — names the tech | ✅ |
| "Viral subtitle burning — 5 styles" | Yes — names the styles | ✅ |
| "Auto SRT via Whisper" | Yes — names the tool | ✅ |
| "Short preview — video player" | Yes — names the feature | ✅ |
| "DB auto-initialization" | Yes — names the fix | ✅ |

## Documentation coverage

| Document | Updated for v0.3? |
|----------|-------------------|
| README.md | ✅ — Requirements section (FFmpeg, Python), updated Quickstart |
| ARCHITECTURE.md | ✅ (from v0.2) |
| CONTRIBUTING.md | ✅ (from v0.2) |
| CHANGELOG.md | ✅ — v0.3.0 section with all changes |
| .env.example | ✅ — relative DB path |
| docs/youtube-oauth.md | ✅ (from v0.2) |
| docs/reviews/ | ✅ — 5 new review files |

## Release notes

```markdown
# Shorts Pilot v0.3.0 — Real video processing

The shorts pipeline now creates actual video files. Upload a video, and
Shorts Pilot cuts it into vertical shorts with burned-in viral subtitles.

## What's new

### Real video processing (FFmpeg)
- Each short is cut from the source video and converted to 9:16 vertical (1080x1920)
- 5 viral subtitle styles: Pop, Bounce, Neon, Kinetic, Fade (with on/off toggle)
- In-video title header + duration overlay

### SRT support
- Upload .srt files, paste SRT content, or auto-generate via Whisper
- Auto-generation uses faster-whisper (CPU-only, low-spec friendly)
- SRT timestamps give the LLM accurate segment boundaries

### Preview + download
- Video player for every generated short
- Download individual shorts or all at once
- Batch schedule selected shorts with 2-hour spacing

### Dynamic short count
- The LLM finds ALL viable moments — 1, 5, 10, 15, or however many the video contains
- No longer capped at 6

### Reliability
- DB auto-creates on `npm run dev` (no more "DATABASE_URL not found")
- Cross-platform DB path resolution
- Health check at `/api/health`
- Graceful error messages when DB isn't ready

## Requirements
- FFmpeg (with libass for subtitles)
- Python 3 + faster-whisper (optional, for auto SRT)

## Upgrade
1. `git pull`
2. `npm install`
3. `npm run dev` (auto-runs db:push)
```

## Ship readiness: READY TO TAG v0.3.0
