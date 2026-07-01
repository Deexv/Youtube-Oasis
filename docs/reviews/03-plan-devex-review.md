# /plan-devex-review — Shorts Pilot

> gstack `/plan-devex-review` skill output. Interactive developer experience
> plan review. Explores developer personas, benchmarks against competitors,
> designs magical moments, and traces friction points before scoring.
> Three modes: DX EXPANSION, DX POLISH, DX TRIAGE. This run uses
> **DX POLISH** — bulletproof every touchpoint.

**Project**: Shorts Pilot
**Date**: 2026-07-01
**Mode**: DX POLISH

## Developer personas

### P1 — "Solo YouTuber who codes"
- Has a YouTube channel, knows JavaScript, wants to automate their posting schedule.
- Will clone the repo, run `bun install`, set up `.env`, run `bun run dev`.
- Cares about: does it actually post to YouTube? Can I tweak the schedule?
- Frustrated by: opaque errors, mock mode that hides the real flow, configs that need a CS degree.

### P2 — "Open-source contributor"
- Found the repo on GitHub, wants to add a feature (e.g. thumbnail generation, multi-channel support).
- Will read README, try to run tests, look at the code structure.
- Cares about: is the codebase navigable? Are there tests? Is the architecture documented?
- Frustrated by: no tests, no architecture doc, magic numbers in the scheduler.

### P3 — "Self-hoster"
- Wants to deploy this on their own server / VPS / Docker.
- Cares about: can it run headless? Does it need a database server? Can I put it behind nginx?
- Frustrated by: SQLite path hardcoded, no Dockerfile, no healthcheck endpoint.

## Competitor benchmark

| Feature | Shorts Pilot | yt-scheduler (npm) | Hootsuite | Buffer |
|---------|-------------|--------------------|-----------| -------|
| Open source | ✅ | ✅ | ❌ | ❌ |
| Self-hostable | ✅ | ✅ | ❌ | ❌ |
| Native YouTube scheduling | ✅ (Data API v3) | ✅ | ✅ | ✅ |
| AI shorts generation | ✅ (6-beat pattern) | ❌ | ❌ | ❌ |
| Multi-LLM rotation | ✅ (Z.AI/Groq/Gemini/Claude) | ❌ | ❌ | ❌ |
| Configurable daily caps | ✅ | ❌ | ✅ | ✅ |
| 2h minimum spacing | ✅ | ❌ | ❌ | ❌ |
| Free | ✅ | ✅ | ❌ | freemium |

**Competitive advantage**: AI-powered shorts generation with the 6-beat narrative pattern + multi-LLM rotation. No competitor offers this.

## Magical moments (to preserve)

1. **"It actually posted"** — the first time a user sees a real video appear as Private on their YouTube Studio with a scheduled publish time. This is the aha-moment. The Settings tab must clearly show "Live mode" + "OAuth ready" so the user trusts the flow is real.
2. **"It found the right moments"** — when the 6-beat pattern surfaces a moment the user recognizes as the best part of their video. The beat labels (Hook/Problem, Rising Action, etc.) make this visible.
3. **"It spaced them perfectly"** — when the user sees 3 shorts on day 1 at 9:00, 11:00, 13:00 and 3 more on day 2. The Upcoming tab timeline makes this visible.

## Friction points (DX TRIAGE)

### F1 [CRITICAL] — No README
**Friction**: A contributor clones the repo and there is no `README.md` at the root (only `download/README.md` which is the scaffold default). They don't know what the project does, how to run it, or what the .env keys mean.
**Fix**: T1 — write a root `README.md` with: what it is, screenshot, quickstart, .env reference, link to `docs/youtube-oauth.md`.

### F2 [CRITICAL] — No tests
**Friction**: A contributor wants to refactor the scheduler but there are zero tests. They can't verify their change doesn't break the daily-cap logic or the 2h-spacing algorithm.
**Fix**: T2 — add unit tests for `src/lib/scheduler.ts` (the core logic) using Bun's test runner.

### F3 [HIGH] — No architecture doc
**Friction**: A contributor opens the repo and sees 30+ files. There's no map of how the pieces fit together (API → lib → DB → YouTube).
**Fix**: T3 — write `ARCHITECTURE.md` with a diagram and a "request lifecycle" walkthrough.

### F4 [HIGH] — No Dockerfile / deployment guide
**Friction**: A self-hoster can't deploy without reading `package.json` and figuring out the commands.
**Fix**: T4 — add a `Dockerfile` and a `docs/deploy.md` guide.

### F5 [MEDIUM] — `.env.example` exists but isn't referenced from README
**Friction**: The `.env.example` file is good, but a new user won't know to copy it unless the README tells them to.
**Fix**: T1 covers this (quickstart step: `cp .env.example .env`).

### F6 [MEDIUM] — No CONTRIBUTING.md
**Friction**: A contributor doesn't know the branch/commit/PR conventions.
**Fix**: T5 — write `CONTRIBUTING.md`.

### F7 [MEDIUM] — API routes have no input validation
**Friction**: `POST /api/long-form` accepts a body and trusts it. If a user sends `duration: "abc"` it becomes `0` silently. This isn't a security issue (single-user app) but it makes the API hard to reason about.
**Fix**: T6 — add Zod schemas to the API routes.

### F8 [LOW] — No healthcheck endpoint
**Friction**: A self-hoster can't tell if the app is alive without loading the full page.
**Fix**: T7 — add `GET /api/health` returning `{ ok: true, db: true, youtube: bool }`.

### F9 [LOW] — Error messages don't link to docs
**Friction**: When YouTube OAuth isn't configured, the error is "YouTube is not configured. Set YOUTUBE_CLIENT_ID, ...". It doesn't link to `docs/youtube-oauth.md`.
**Fix**: T8 — append "See docs/youtube-oauth.md for setup instructions." to the error.

## DX scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Time to first run | 6/10 | needs README (F1) |
| Time to first real YouTube post | 5/10 | needs OAuth doc link in errors (F9) |
| Code navigability | 7/10 | good file structure, needs ARCHITECTURE.md (F3) |
| Test confidence | 2/10 | no tests (F2) |
| Deployability | 4/10 | no Dockerfile (F4) |
| API robustness | 5/10 | no validation (F7) |
| Error actionability | 6/10 | errors are clear but don't link to docs (F9) |
| **Overall DX** | **5.0/10** | |

## Implementation Tasks

- [ ] **T1 (P1)** — Docs — write root `README.md` with quickstart + .env reference
- [ ] **T2 (P1)** — Tests — add unit tests for `src/lib/scheduler.ts` (daily caps, 2h spacing, random time in window)
- [ ] **T3 (P1)** — Docs — write `ARCHITECTURE.md` with diagram + request lifecycle
- [ ] **T4 (P2)** — Deploy — add `Dockerfile` + `docs/deploy.md`
- [ ] **T5 (P2)** — Docs — write `CONTRIBUTING.md`
- [ ] **T6 (P2)** — API — add Zod input validation to all POST routes
- [ ] **T7 (P3)** — API — add `GET /api/health` healthcheck
- [ ] **T8 (P3)** — Errors — append doc links to configuration errors

## VERDICT

The DX is weak at the boundaries (no README, no tests, no deploy guide) but strong in the core (clean lib separation, real integrations, multi-LLM rotation). The single highest-leverage fix is **T1 (README)** — it's the first thing every persona reads. The second is **T2 (tests)** — without them, no contributor will feel safe refactoring the scheduler.
