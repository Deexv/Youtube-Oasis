# Changelog

All notable changes to Shorts Pilot are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- `pnpm-workspace.yaml` with `onlyBuiltDependencies` allowlist.

### Changed
- **Migrated from bun to pnpm** — `pnpm install && pnpm run dev`. Removed `bun.lock`, added `pnpm-lock.yaml`.
- **Settings "Z.AI API key" card → "API keys"** — now covers all 4 providers (Z.AI, Groq, Gemini, Claude) with model names + configured status.
- **Heavy SDK imports are now dynamic** — `googleapis`, `@google/genai`, `@anthropic-ai/sdk`, `openai`, `z-ai-web-dev-sdk` are loaded lazily inside the functions that use them, saving ~500 MB of server memory.
- **Dashboard SSR disabled** — the Dashboard is loaded via `dynamic(..., { ssr: false })` to avoid hydration mismatches caused by browser extensions (DarkReader).
- **YouTube default mode is live** — `YOUTUBE_MOCK_MODE=false` by default. Mock mode must be opted into explicitly.
- **OAuth setup is now one-click** — the old manual OAuth Playground flow is replaced by the in-app "Add YouTube account" button.
- `LongFormVideo` and `Short` models now have an `accountId` field linking to `YouTubeAccount`.
- `package.json` scripts updated for pnpm (removed `bun` from `start` script, removed `tee dev.log`).

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
