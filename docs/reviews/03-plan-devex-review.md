# /plan-devex-review — Shorts Pilot v0.2

> gstack `/plan-devex-review` skill output. Developer experience review.

**Project**: Shorts Pilot v0.2
**Date**: 2026-07-01
**Mode**: DX POLISH

## What changed since v0.1

- Migrated from bun to **pnpm** (pnpm-lock.yaml, pnpm-workspace.yaml, scripts updated)
- LLM models now configurable via env (`ZAI_MODEL`, `GROQ_MODEL`, `GEMINI_MODEL`, `ANTHROPIC_MODEL`)
- Real file upload via multipart/form-data with live progress
- Multi-account YouTube OAuth flow (add accounts via Google login, no manual token copy)
- Upload limit configurable in dashboard Settings
- Dedicated Create tab

## Developer personas (updated)

### P1 — Solo YouTuber who codes
- Can now `pnpm install && pnpm run dev` — standard Node workflow.
- Can swap LLM models without code changes (e.g. `GROQ_MODEL=llama-3.1-8b-instant`).
- Can connect YouTube accounts by clicking a button — no more manual OAuth playground.
- **Satisfaction**: high.

### P2 — Open-source contributor
- pnpm is the standard package manager for most OSS projects — lower friction than bun.
- `pnpm-workspace.yaml` documents the build-script allowlist explicitly.
- The new `YouTubeAccount` model is well-documented in ARCHITECTURE.md.
- **Satisfaction**: high.

### P3 — Self-hoster
- pnpm is available on all Linux distros via `npm install -g pnpm`.
- The `uploads/` directory is gitignored and documented.
- The OAuth redirect URI is configurable via `YOUTUBE_REDIRECT_URI`.
- **Satisfaction**: high.

## DX scorecard (v0.2)

| Dimension | v0.1 | v0.2 | Notes |
|-----------|------|------|-------|
| Time to first run | 6/10 | 8/10 | pnpm is more familiar; README updated |
| Time to first real YouTube post | 5/10 | 9/10 | OAuth flow is now one click |
| LLM flexibility | 5/10 | 9/10 | Models swappable via env |
| Upload experience | 2/10 | 9/10 | Real file upload with progress |
| Multi-account support | 0/10 | 9/10 | Clever color-coded selector |
| Code navigability | 7/10 | 8/10 | Dynamic imports documented |
| Test confidence | 2/10 | 2/10 | Still no tests (deferred) |
| Deployability | 4/10 | 5/10 | pnpm is more deploy-friendly |
| **Overall DX** | **5.0/10** | **7.4/10** | |

## Remaining DX friction

### F1 [MEDIUM] — No tests
Still no automated tests. The scheduler logic (`pickRandomTimeInWindow`, `findNextShortSlot`) is pure and testable. **Fix**: add `src/lib/__tests__/scheduler.test.ts` with Vitest.

### F2 [MEDIUM] — No Dockerfile
Self-hosters still need to figure out the deployment manually. **Fix**: add a Dockerfile + `docs/deploy.md`.

### F3 [LOW] — pnpm-workspace.yaml onlyBuiltDependencies
The `onlyBuiltDependencies` list is necessary because pnpm 10+ blocks postinstall scripts. A new contributor adding a dependency with a build script will need to add it to this list. This is documented in the file but could be clearer in CONTRIBUTING.md.

### F4 [LOW] — Dynamic imports make stack traces harder to read
The LLM and YouTube libs now use `await import(...)` to save memory. Stack traces from errors inside these functions will show the dynamic import wrapper. Acceptable trade-off.

## Implementation Tasks

- [ ] **T1 (P1, carried)** — Tests — add unit tests for scheduler.ts
- [ ] **T2 (P2, carried)** — Deploy — add Dockerfile + docs/deploy.md
- [ ] **T3 (P3)** — Docs — mention `onlyBuiltDependencies` in CONTRIBUTING.md
- [ ] **T4 (P3)** — Docs — document the dynamic import pattern in ARCHITECTURE.md

## VERDICT

The v0.2 changes are a massive DX improvement — from 5.0 to 7.4. The biggest wins are the one-click YouTube OAuth (was a multi-step manual process) and the real file upload with progress (was a path text input). The remaining gap is tests + Docker, both tracked.
