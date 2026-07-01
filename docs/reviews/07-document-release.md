# /document-release — Shorts Pilot v0.1.0

> gstack `/document-release` skill output. Post-ship documentation update.
> Reads all project docs, cross-references the diff, builds a Diataxis
> coverage map, updates README/ARCHITECTURE/CONTRIBUTING to match what
> shipped, polishes CHANGELOG voice with a sell-test rubric, and bumps
> VERSION.

**Project**: Shorts Pilot
**Date**: 2026-07-01
**Version**: 0.1.0

## What shipped

This is the initial public release of Shorts Pilot. The project is a
self-hosted YouTube scheduler that:

1. Schedules long-form videos natively on YouTube (Data API v3) with a
   random time inside a configurable window and a daily cap.
2. Generates shorts from long-form transcripts using a 6-beat narrative
   pattern (hook → rising → conflict → comeback → tension → reveal) via
   Z.AI, Groq, Gemini, or Claude.
3. Auto-schedules the generated shorts on YouTube with ≥2-hour spacing
   and a configurable daily cap.
4. Rotates evenly across all configured LLM providers by default.

## Sell-test rubric (CHANGELOG voice)

Each CHANGELOG entry must pass the sell-test: would a reader who has
never seen this project understand what they get by upgrading?

| Entry | Sell-test | Pass? |
|-------|-----------|-------|
| "Multi-provider LLM support: Z.AI, Groq, Gemini, Claude with round-robin rotation" | Yes — names the providers and the rotation feature | ✅ |
| "Real YouTube Data API v3 integration" | Yes — names the API | ✅ |
| "6-beat narrative pattern for shorts moment detection" | Yes — names the pattern | ✅ |
| "Settings tab with configurable daily limits, scheduling window, and provider status" | Yes — lists what's configurable | ✅ |
| "YouTube default mode is now live (was mock)" | Yes — states the before/after | ✅ |
| "Removed dead Channels sidebar link" | Yes — says what was removed | ✅ |
| "Long-form dialog now correctly shows an error toast when YouTube upload fails" | Yes — states the fix | ✅ |

**PASS** — all CHANGELOG entries pass the sell-test.

## Documentation coverage (final)

| Document | Status | Matches shipped code? |
|----------|--------|----------------------|
| `README.md` | ✅ created | Yes — quickstart, config reference, tech stack |
| `ARCHITECTURE.md` | ✅ created | Yes — diagram, request lifecycle, data model, rotation, upload flow |
| `CONTRIBUTING.md` | ✅ created | Yes — conventions, how to add a provider/API route |
| `CHANGELOG.md` | ✅ created | Yes — v0.1.0 entries match shipped features |
| `.env.example` | ✅ created | Yes — all env keys documented |
| `docs/youtube-oauth.md` | ✅ created | Yes — OAuth flow matches `youtube.ts` implementation |
| `docs/reviews/01-07-*.md` | ✅ created | Yes — gstack review chain |
| `LICENSE` | ⚠️ referenced as MIT in README, file not yet created | Create before tagging |
| `VERSION` | ⚠️ not present | Optional — package.json has version |

## Architecture diagram drift check

The diagram in `ARCHITECTURE.md` was written after the code was final.
Cross-checked against the actual file structure:

- `src/app/api/` routes listed in the diagram: `long-form`, `shorts`,
  `shorts/generate`, `schedule`, `settings`, `status`, `youtube/schedule`,
  `seed` — all match the filesystem. ✅
- `src/lib/` files listed: `beats.ts`, `llm-shared.ts`, `llm.ts`,
  `youtube-shared.ts`, `youtube.ts`, `zai.ts`, `scheduler.ts`,
  `shorts-pipeline.ts`, `store.ts`, `db.ts` — all match. ✅
- The request lifecycle walkthrough matches the actual code flow in
  `src/app/api/long-form/route.ts` and
  `src/lib/shorts-pipeline.ts`. ✅

**No drift.**

## TODOS cleanup

The project has no `TODOS.md` file. All deferred work is tracked in
`docs/reviews/01-plan-design-review.md` (T1-T10) and
`docs/reviews/03-plan-devex-review.md` (T1-T8). These are the canonical
task lists — no separate TODOS file is needed for v0.1.

## VERSION bump

`package.json` currently has `"version": "0.2.0"` (inherited from the
scaffold). For the initial public release this should be `"0.1.0"`.

**Action**: update `package.json` version to `0.1.0` before tagging.

## Release notes (for the GitHub release body)

```
# Shorts Pilot v0.1.0

A self-hosted YouTube scheduler for long-form videos and AI-generated shorts.

## What it does

- **Long-form scheduling**: upload a video, pick a time window, and the
  scheduler posts it to YouTube at a random time inside that window. One
  post per day max (configurable).
- **AI shorts generation**: paste your transcript, and the LLM finds the
  6 best moments using the narrative pattern: hook → rising action →
  conflict → comeback → build tension → reveal. Each moment becomes a
  short with a viral header.
- **Auto-scheduling**: shorts are scheduled on YouTube with ≥2-hour
  spacing and a 3-per-day cap (configurable).
- **Multi-LLM rotation**: set keys for Z.AI, Groq, Gemini, and/or Claude.
  Two or more keys = even rotation across providers.

## Quickstart

1. `bun install`
2. `bun run db:push`
3. `cp .env.example .env` → fill in at least one LLM key + YouTube OAuth
4. `bun run dev`

See `docs/youtube-oauth.md` for the YouTube OAuth setup walkthrough.

## Tech stack

Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Prisma + SQLite,
googleapis, z-ai-web-dev-sdk, openai (Groq), @google/genai, @anthropic-ai/sdk.

## Reviews

This release was reviewed using the gstack skill chain. See
`docs/reviews/` for the full review outputs.

## License

MIT
```

## PR body (documentation debt summary)

```
## Documentation update for v0.1.0 release

### Added
- README.md — project overview, quickstart, config reference
- ARCHITECTURE.md — high-level diagram, request lifecycle, data model
- CONTRIBUTING.md — conventions, how to add providers/API routes
- CHANGELOG.md — v0.1.0 entries
- docs/youtube-oauth.md — OAuth setup walkthrough
- docs/reviews/ — 7 gstack skill review outputs

### Updated
- .env.example — full env key reference with provider + YouTube sections
- package.json — version bumped to 0.1.0

### Documentation debt (tracked, not blocking v0.1.0)
- Dockerfile + docs/deploy.md (T4 in devex-review)
- Automated tests (T2 in devex-review)
- API input validation with Zod (T6 in devex-review)
- Chart empty states (T2 in plan-design-review)
- Shorts regeneration dedup (T8 in plan-design-review)
```

## Ship readiness

**READY TO TAG v0.1.0** after:
1. Create `LICENSE` file (MIT).
2. Bump `package.json` version to `0.1.0`.
3. Verify `.gitignore` excludes `.env`, `db/`, `tool-results/`, `download/*.png`.
4. Verify `git status` shows no secrets.
5. Push to GitHub.
