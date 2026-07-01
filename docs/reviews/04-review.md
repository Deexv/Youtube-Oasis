# /review — Shorts Pilot (pre-landing)

> gstack `/review` skill output. Analyzes diff against the base branch for
> SQL safety, LLM trust boundary violations, conditional side effects, and
> other structural issues.

**Project**: Shorts Pilot
**Date**: 2026-07-01
**Base**: initial commit (no prior history)
**Diff scope**: all source files (initial import)

## Summary

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 3 |
| Medium | 5 |
| Low | 4 |
| Info | 3 |

**Recommendation**: **DO NOT LAND** until C1 is fixed. Everything else can land with follow-up tasks.

---

## Critical

### C1 — Secrets will be committed if `.env` is not gitignored
**File**: `.gitignore` (missing)
**Issue**: The repo has no `.gitignore`. The `.env` file contains live API keys (or will, once the user fills them in). If `.env` is committed to the public repo, every key is leaked.
**Fix**: Create `.gitignore` with `.env`, `db/`, `node_modules/`, `.next/`, `tool-results/`, `download/`. Verify with `git status` that `.env` does not appear.
**Status**: **BLOCKING** — must fix before push.

---

## High

### H1 — `tool-results/` directory contains 6 large text dumps from subagent reads
**File**: `tool-results/read_*.txt` (6 files, ~5900 lines total)
**Issue**: These are internal tool outputs (the gstack SKILL.md reads) that were accidentally saved to the project root. They contain no secrets but are noise in a public repo.
**Fix**: Delete the `tool-results/` directory and add it to `.gitignore`.
**Status**: Fix before push.

### H2 — `download/` directory contains screenshots with no production value
**File**: `download/*.png` (6 files)
**Issue**: These are dev screenshots from the agent-browser verification. They bloat the repo and have no value for end users.
**Fix**: Delete `download/*.png` (keep `download/README.md` if present) and add `download/*.png` to `.gitignore`.
**Status**: Fix before push.

### H3 — Shorts generation is append-only with no deduplication
**File**: `src/lib/shorts-pipeline.ts:38-57`
**Issue**: `generateShortsFromLongForm()` always creates new `Short` rows. If a user clicks "Generate shorts" twice on the same long-form video, they get 12 shorts (6 duplicate beats). The scheduler will then try to schedule 12 shorts, violating the 3/day cap and pushing posts far into the future.
**Fix**: Before generating, delete existing shorts for this `longFormId` that are still in `draft` or `ready` status. Or: ask the user to confirm replacement (prescribed in `01-plan-design-review.md` T8).
**Status**: Track as T8 in plan-design-review.

---

## Medium

### M1 — `rotationCursor` is module-level state, not request-scoped
**File**: `src/lib/llm.ts:45`
**Issue**: `let rotationCursor = 0` persists across all requests in the server process. This is the intended behavior for round-robin, but it means the first request always uses provider[0], the second always uses provider[1], etc. If the server restarts, the cursor resets. In a multi-instance deployment, each instance has its own cursor and they'll all hammer provider[0] simultaneously.
**Fix**: Documented in the comment. For multi-instance, move to Redis. For now, acceptable.
**Status**: Accepted with comment.

### M2 — YouTube upload has no timeout
**File**: `src/lib/youtube.ts:150-170`
**Issue**: `youtube.videos.insert()` with a large file can hang indefinitely if the connection drops. There's no `AbortController` or timeout.
**Fix**: Wrap in a `Promise.race` with a 10-minute timeout, or pass `timeout: 600000` to the googleapis client.
**Status**: Track as follow-up.

### M3 — `fetch(filePath)` in youtube.ts has no SSRF protection
**File**: `src/lib/youtube.ts:135`
**Issue**: If `filePath` comes from user input (it does — the New long-form dialog accepts any string), a user could pass `http://169.254.169.254/latest/meta-data/` to hit AWS metadata endpoints from the server. This is a server-side request forgery vector.
**Fix**: Validate `filePath` against an allowlist of domains, or block private IP ranges (`10.x`, `172.16-31.x`, `192.168.x`, `169.254.x`, `127.x`).
**Status**: Track as security follow-up. Note: this is a single-user self-hosted app so the risk is low (the user would only SSRF themselves), but it should still be fixed before the repo gains contributors.

### M4 — No input validation on API routes
**File**: `src/app/api/long-form/route.ts`, `src/app/api/shorts/generate/route.ts`, etc.
**Issue**: `POST /api/long-form` does `const body = await req.json()` and trusts every field. `duration` is coerced with `Number(duration) || 0` which silently turns `"abc"` into `0`. `windowStart` / `windowEnd` are accepted as-is with no time-format validation.
**Fix**: Add Zod schemas. Track as T6 in devex-review.
**Status**: Track as T6.

### M5 — Prisma queries log every SQL statement
**File**: `src/lib/db.ts:10`
**Issue**: `new PrismaClient({ log: ['query'] })` logs every query to stdout. In production this is noisy and can leak data (transcript text appears in the query log).
**Fix**: Change to `log: process.env.NODE_ENV === 'development' ? ['query'] : []` or remove entirely.
**Status**: Fix before push (low effort).

---

## Low

### L1 — `Readable.fromWeb(resp.body as any)` uses `as any`
**File**: `src/lib/youtube.ts:139`
**Issue**: The `as any` bypasses type checking on the Web ReadableStream → Node Readable conversion.
**Fix**: Use the proper type: `Readable.fromWeb(resp.body as ReadableStream<Uint8Array>)`.
**Status**: Minor.

### L2 — `fakeYoutubeId()` uses `Math.random()` which is not crypto-secure
**File**: `src/lib/youtube.ts:73`
**Issue**: Mock video IDs are predictable. Not a security issue (mock mode only) but could cause collisions in tests.
**Fix**: Use `crypto.randomUUID()` or accept the collision risk.
**Status**: Accepted (mock mode only).

### L3 — `detectMoments` swallows all errors silently
**File**: `src/lib/zai.ts:73-82`
**Issue**: The `catch {}` block in `detectMoments` catches everything (including JSON parse errors, network errors, auth errors) and falls back to `fallbackMoments()`. The user never knows the LLM call failed.
**Fix**: Log the error to console and surface a warning in the API response (`{ warning: "LLM call failed, used fallback splitter" }`).
**Status**: Track as follow-up.

### L4 — `generateShortHeader` returns a string, not the full `{header, description}` object
**File**: `src/lib/zai.ts:86-103`
**Issue**: The function asks the LLM for `{"header": string, "description": string}` but only returns the `header`. The `description` is discarded. The `Short` model has a `description` field that's populated from `moment.rationale` instead, which is fine, but the LLM-generated description is wasted.
**Fix**: Return both and use the LLM description as the YouTube video description.
**Status**: Track as enhancement.

---

## Info

### I1 — Provider order is hardcoded as `[zai, groq, gemini, anthropic]`
**File**: `src/lib/llm-shared.ts:6`
**Note**: This is intentional — Z.AI is the project's primary provider. Documented in `.env.example`.

### I2 — `BEAT_ORDER` and `BEAT_LABELS` are duplicated in `beats.ts` and `zai.ts`
**File**: `src/lib/beats.ts`, `src/lib/zai.ts`
**Note**: `zai.ts` re-exports from `beats.ts`, so there's no duplication. The import in `zai.ts` is for internal use only. **OK.**

### I3 — `youtube.ts` imports `google` from `googleapis` at module top-level
**File**: `src/lib/youtube.ts:24`
**Note**: This means any code path that imports `youtube.ts` (even just for `youtubeWatchUrl`) would pull in googleapis. **Fixed** by splitting client-safe helpers into `youtube-shared.ts`. **OK.**

---

## SQL safety check

- No raw SQL — all queries go through Prisma's typed query builder. **PASS.**
- No `Prisma.$queryRaw` or `$executeRaw` usage. **PASS.**
- All `where` clauses use typed operators (`gte`, `lte`, `in`). **PASS.**

## LLM trust boundary check

- LLM output is parsed as JSON and normalized via `normalizeMoment()` which clamps `sourceStart`/`sourceEnd` to `[0, totalDurationSec]`. **PASS.**
- LLM-generated headers are truncated to 60 chars. **PASS.**
- LLM output is never executed as code or used in SQL. **PASS.**
- LLM output is never displayed to the user without sanitization (React escapes by default). **PASS.**

## Conditional side effects check

- `scheduleOnYouTube()` makes a network call to YouTube. It's called inside a `try/catch` in `shorts-pipeline.ts:88-100`. On failure, the short is marked `failed` and the loop continues. **PASS** (but see H3 for the dedup issue).
- `db.short.create()` is called inside the loop. If the process crashes mid-loop, some shorts are created and some aren't. There's no transaction wrapping. **FLAG** — acceptable for a single-user scheduler, but a transaction would be cleaner.

---

## Fixes applied in this review pass

1. Created `.gitignore` (C1) — see Phase 3.
2. Changed Prisma log to dev-only (M5).
3. Deleted `tool-results/` and `download/*.png` (H1, H2) — see Phase 3.

## Fixes tracked for follow-up

- H3 (shorts dedup) → T8 in plan-design-review
- M2 (upload timeout) → follow-up
- M3 (SSRF protection) → follow-up
- M4 (input validation) → T6 in devex-review
- L3 (silent error swallowing) → follow-up
- L4 (unused LLM description) → enhancement
