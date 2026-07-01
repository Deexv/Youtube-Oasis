# Changelog

All notable changes to Shorts Pilot are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] — 2026-07-01

### Added — Real video processing pipeline
- **FFmpeg-powered short creation** — shorts are now actual video files (not just DB rows with timestamps). Each short is cut from the source video, converted to 9:16 vertical (1080x1920), and saved as an MP4.
- **Viral subtitle burning** — 5 subtitle styles (Pop, Bounce, Neon, Kinetic, Fade) burned into the video via FFmpeg + ASS subtitles. Plus an on/off toggle.
- **In-video title header** — each short gets the viral header text overlaid at the top, plus a duration display at the bottom-right.
- **SRT support** — upload, paste, or auto-generate SRT files for accurate word-level timing. The LLM uses SRT timestamps to pick precise segment boundaries.
- **Auto SRT via Whisper** — `scripts/generate-srt.py` uses `faster-whisper` (CTranslate2 backend, CPU-only, low-spec friendly) to transcribe audio and output SRT.
- **Short preview** — video player in the Create tab lets you preview every generated short before scheduling.
- **Download** — download individual shorts or all at once. Files are served with proper Content-Disposition headers.
- **Batch scheduling** — select which shorts to schedule, then schedule them all with proper 2-hour spacing.
- **Dynamic short count** — the LLM now finds ALL viable moments (1-15+), not capped at 6. The prompt explicitly says "A video might have 1 viable moment, or it might have 15."

### New API routes
- `POST /api/shorts/generate-v2` — the full pipeline: detect moments → cut → convert → subtitle → save
- `GET /api/shorts/serve?id=...` — serves short video files with range request support for seeking
- `POST /api/shorts/schedule-batch` — schedule selected shorts with proper spacing
- `POST /api/srt/generate` — auto-generate SRT via faster-whisper

### New components
- `ShortPreviewCard` — video player + beat badge + select checkbox + download button
- Updated `CreatePanel` with a 2-step shorts wizard: upload video → add SRT + pick style → generate → preview → select → schedule

### Changed
- LLM prompt updated to find ALL viable moments, not cap at 6
- SRT-formatted transcripts (with timestamps) are now passed to the LLM for accurate timing
- Shorts are created with `status: "ready"` (not auto-scheduled) — user previews and picks
- `video-processor.ts` — new lib with `processShort()`, `getVideoDuration()`, `isFFmpegAvailable()`, `generateSRTViaWhisper()`
- `srt.ts` — new lib with `parseSRT()`, `extractSrtSegment()`, `srtToTranscript()`, `generateSRT()`

### Requirements
- **FFmpeg** must be installed (with libass for subtitle burning)
- **Python 3 + faster-whisper** for auto SRT generation (optional — users can paste SRT manually)
- See README "Requirements" section for install instructions

## [0.2.2] — 2026-07-01

### Added
- **In-app YouTube OAuth setup wizard** — users no longer need to edit `.env` to configure Google OAuth. The Settings tab now shows a 4-step wizard with direct links to Google Cloud Console, a copy-paste redirect URI, and a form to paste the Client ID + Secret. Credentials are stored in the app's SQLite database.
- New `YouTubeSetupWizard` component with step-by-step instructions and credential input.
- New `/api/youtube/oauth-config` API route (GET / POST / DELETE) for managing OAuth credentials from the UI.
- New `src/lib/youtube-oauth-settings.ts` — reads OAuth credentials from the DB first, falls back to env vars.
- `isYouTubeConfiguredAsync()` — authoritative async check that looks at both DB and env.

### Changed
- `youtube.ts` now reads OAuth client credentials from the DB (set via the wizard) instead of only from env vars. Env vars still work as a fallback for CI/CD.
- The Settings "YouTube accounts" card shows the setup wizard when OAuth isn't configured, and the "Connect with Google" button when it is.
- The account selector in the Create tab now points users to Settings if no account is connected.
- Status API (`/api/status`) and healthcheck (`/api`) now use the async check so they report `configured: true` when credentials are in the DB.

### Removed
- The old "Set YOUTUBE_CLIENT_ID in .env first" error message is replaced by the in-app wizard.

## [0.2.1] — 2026-07-01

### Changed
- **Migrated from pnpm to npm** — switched the package manager from pnpm to npm (the Node.js default). Removed `pnpm-lock.yaml` and `pnpm-workspace.yaml`, added `package-lock.json`. All docs updated to use `npm install` / `npm run dev`.
- **Cross-platform dev script** — the `dev` script now uses `cross-env` to set `NODE_OPTIONS` so it works on Windows, macOS, and Linux without shell-specific syntax.
- **Auto-generate Prisma client on dev/build** — added `predev` and `prebuild` npm hooks that run `prisma generate` automatically, so you never get a "Prisma Client not found" error after pulling or switching branches.
- Added `cross-env` as a dev dependency.

### Removed
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `.npmrc`

## [0.2.0] — 2026-07-01

### Added
- **Multi-account YouTube support** — connect multiple YouTube channels via one-click Google OAuth. Each account gets a distinct color to prevent posting to the wrong channel.
- **Real file upload with progress bars** — drag-and-drop or click to browse. Live upload progress (XHR-based). Supports MP4, MOV, WebM, MKV, AVI.
- **Dedicated Create tab** — a wizard for uploading long-form videos and generating shorts, with a multi-step progress indicator.
- **Per-provider LLM model override** — set `ZAI_MODEL`, `GROQ_MODEL`, `GEMINI_MODEL`, `ANTHROPIC_MODEL` in `.env` to use a different model.
- **Upload limit configurable in dashboard** — `uploadLimitMb` setting persisted to DB, enforced in the upload route.
- **YouTube accounts management** — connect, disconnect, set default, all from the Settings tab.
- **Google OAuth login flow** — `/api/youtube/auth` + `/api/youtube/callback` routes. No more manual token copy from OAuth Playground.
- `YouTubeAccount` Prisma model (displayName, channelId, avatarUrl, refreshToken, color, isDefault).
- `FileUploader` component with drag-and-drop + live progress.
- `YouTubeAccountSelector` component with colored confirmation banner.
- `StepProgress` component for multi-step operation visibility.
- `package.json` with `npm ignores build scripts by default` allowlist.

### Changed
- **Migrated from bun to npm** — `npm install && npm run dev`. Removed `bun.lock`, added `package-lock.json`.
- **Settings "Z.AI API key" card → "API keys"** — now covers all 4 providers (Z.AI, Groq, Gemini, Claude) with model names + configured status.
- **Heavy SDK imports are now dynamic** — `googleapis`, `@google/genai`, `@anthropic-ai/sdk`, `openai`, `z-ai-web-dev-sdk` are loaded lazily inside the functions that use them, saving ~500 MB of server memory.
- **Dashboard SSR disabled** — the Dashboard is loaded via `dynamic(..., { ssr: false })` to avoid hydration mismatches caused by browser extensions (DarkReader).
- **YouTube default mode is live** — `YOUTUBE_MOCK_MODE=false` by default. Mock mode must be opted into explicitly.
- **OAuth setup is now one-click** — the old manual OAuth Playground flow is replaced by the in-app "Add YouTube account" button.
- `LongFormVideo` and `Short` models now have an `accountId` field linking to `YouTubeAccount`.
- `package.json` scripts updated for npm (removed `bun` from `start` script, removed `tee dev.log`).

### Fixed
- **False success toast bug** (from v0.1) — the New long-form dialog now correctly shows an error toast when YouTube upload fails, instead of falsely saying "scheduled on YouTube".
- **Hydration mismatch** in `ConversationVolumeChart` — `Math.random()` in `buildLastNDays` replaced with a deterministic pseudo-random function.
- **Dead "Channels" sidebar link** — removed.
- **Fake "just now" activity feed entry** — removed; the feed now shows only real events.

### Security
- `.gitignore` now excludes `uploads/` (user-uploaded video files).
- OAuth `state` parameter is only used as a path suffix (no absolute-URL injection).
- OAuth scopes limited to `youtube.upload` + `youtube`.

## [0.1.0] — 2026-07-01

### Added
- Initial release.
- YouTube long-form scheduler with random time-in-window and daily cap.
- AI-powered shorts generation with 6-beat narrative pattern (hook → rising → conflict → comeback → tension → reveal).
- Auto-scheduling of shorts with ≥2h spacing and daily cap.
- Dashboard built on @efferd/dashboard-3 (shadcn/ui New York).
- Multi-LLM provider support with rotation (Z.AI, Groq, Gemini, Claude).
- Native YouTube scheduling via Data API v3.
- README, ARCHITECTURE, CONTRIBUTING, CHANGELOG, LICENSE.
- gstack review chain in docs/reviews/.
