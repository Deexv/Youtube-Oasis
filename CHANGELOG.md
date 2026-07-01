# Changelog

All notable changes to Shorts Pilot are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-provider LLM support: Z.AI, Groq, Gemini, Claude with round-robin rotation
- Real YouTube Data API v3 integration (`videos.insert` + `publishAt`)
- 6-beat narrative pattern for shorts moment detection
- Settings tab with configurable daily limits, scheduling window, and provider status
- New long-form dialog with transcript input and per-video scheduling window
- Upcoming schedule timeline grouped by day
- Seed demo data button
- `docs/youtube-oauth.md` — OAuth setup walkthrough
- `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`
- `.env.example` with full configuration reference
- gstack review chain in `docs/reviews/`

### Changed
- YouTube default mode is now **live** (was mock). Set `YOUTUBE_MOCK_MODE=true` to opt into mock.
- Prisma query logging is now dev-only (was always on)
- Removed dead "Channels" sidebar link
- Removed fake "just now" entry from the activity feed
- Settings panel now shows per-provider status badges and rotation indicator
- Long-form dialog now correctly shows an error toast when YouTube upload fails (was showing a false success toast)

### Fixed
- `findNextShortSlot` cursor advancement (was treating ISO string as Date)
- Client components pulling in Node-only SDK packages via `youtube.ts` / `llm.ts` imports (split into `*-shared.ts`)
- Duplicate React key warning in stats loading state

### Security
- `.gitignore` added to prevent `.env` and `db/` from being committed

## [0.1.0] — 2026-07-01

### Added
- Initial release.
- YouTube long-form scheduler with random time-in-window and daily cap.
- AI-powered shorts generation with 6-beat narrative pattern.
- Auto-scheduling of shorts with ≥2h spacing and daily cap.
- Dashboard built on @efferd/dashboard-3 (shadcn/ui New York).
- Multi-LLM provider support with rotation.
- Native YouTube scheduling via Data API v3.
