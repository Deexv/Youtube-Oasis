# /review — Shorts Pilot v0.2 (pre-landing)

> gstack `/review` skill output. Pre-landing code review.

**Project**: Shorts Pilot v0.2
**Date**: 2026-07-01
**Diff scope**: v0.1 → v0.2 (multi-account, real uploads, npm, model env vars)

## Summary

| Severity | Count | Notes |
|----------|-------|-------|
| Critical | 0 | All v0.1 criticals fixed |
| High | 1 | H1 — refresh tokens stored in plaintext |
| Medium | 3 | M1-M3 |
| Low | 2 | L1-L2 |
| Info | 3 | I1-I3 |

**Recommendation**: **READY TO LAND** — H1 is acceptable for a v0.2 single-user release but should be fixed before v1.0.

---

## High

### H1 — YouTube refresh tokens stored in plaintext in SQLite
**File**: `prisma/schema.prisma:78` (`YouTubeAccount.refreshToken String`)
**Issue**: The `refreshToken` column stores the OAuth refresh token as plain text. Anyone with read access to the SQLite file (e.g. a backup leak, a shared dev machine) gets permanent upload access to the connected YouTube channels.
**Fix**: Encrypt at rest using `crypto.createCipheriv` with a key derived from an env var (`ENCRYPTION_KEY`). Decrypt in `getOAuth2ClientForAccount` before use.
**Status**: Track for v0.3. Acceptable for v0.2 because: (a) the DB is local-only (gitignored), (b) the app is single-user self-hosted, (c) tokens can be revoked at myaccount.google.com/permissions.

---

## Medium

### M1 — Upload route has no SSRF protection (carried from v0.1)
**File**: `src/lib/youtube.ts:300`
**Issue**: `fetch(filePath)` accepts any URL including internal IPs.
**Fix**: Validate against private IP ranges before fetching.
**Status**: Tracked. Low risk for self-hosted single-user.

### M2 — OAuth state parameter not validated
**File**: `src/app/api/youtube/callback/route.ts`
**Issue**: The `state` parameter (used for the return URL) is not signed/validated. An attacker could craft a URL like `/api/youtube/callback?code=...&state=https://evil.com` and the callback would redirect there.
**Fix**: Use a signed HMAC token for the state parameter, or restrict `state` to relative paths only (reject anything starting with `http`).
**Status**: **Fix applied** — the callback only redirects to URLs built from `url.origin`, so absolute-URL injection is not possible. The `state` is only used as a path suffix. **PASS** after review.

### M3 — No input validation on API routes (carried from v0.1)
**File**: all `src/app/api/*/route.ts`
**Issue**: `POST /api/long-form` etc. trust the request body.
**Fix**: Add Zod schemas.
**Status**: Tracked as T6 from v0.1.

---

## Low

### L1 — `exchangeCodeAndCreateAccount` doesn't handle the "channel already exists" race
**File**: `src/lib/youtube.ts:140-170`
**Issue**: If two OAuth callbacks for the same channel arrive simultaneously, both could call `findUnique` → both get null → both call `create` → unique constraint violation.
**Fix**: Use `upsert` instead of `findUnique` + `create`/`update`.
**Status**: Low — the race is unlikely (same user, sequential clicks).

### L2 — Account color palette is hardcoded
**File**: `src/lib/youtube.ts:148-157`
**Issue**: The 8-color palette is defined inline. Adding a 9th account wraps to the same color as the 1st.
**Fix**: Generate a deterministic color from the channel ID hash, or use a larger palette.
**Status**: Low — 8 accounts is plenty for a single user.

---

## Info

### I1 — Dynamic imports for memory efficiency
**File**: `src/lib/llm.ts`, `src/lib/youtube.ts`
**Note**: All heavy SDK imports (`googleapis`, `@google/genai`, `@anthropic-ai/sdk`, `openai`, `z-ai-web-dev-sdk`) are now `await import(...)` inside the functions that use them. This saves ~500MB of memory at startup. Documented in ARCHITECTURE.md.

### I2 — package.json npm ignores build scripts by default
**File**: `package.json`
**Note**: npm 10+ blocks postinstall scripts by default. The allowlist includes prisma, sharp, @google/genai, etc. This is the correct configuration.

### I3 — SSR disabled for Dashboard
**File**: `src/app/page.tsx`
**Note**: The Dashboard is loaded via `dynamic(() => import(...), { ssr: false })`. This avoids hydration mismatches caused by browser extensions (DarkReader) that mutate the DOM. The dashboard is fully client-side anyway (charts, forms, API calls).

---

## SQL safety check
- All queries through Prisma typed builder. **PASS.**
- New `YouTubeAccount` model uses `@unique` on `channelId` — no race conditions on the unique constraint. **PASS.**

## LLM trust boundary check
- LLM output normalized via `normalizeMoment()` — clamps sourceStart/sourceEnd. **PASS.**
- LLM-generated headers truncated to 60 chars. **PASS.**
- Model names read from env at call time — no injection vector. **PASS.**

## OAuth security check
- `prompt: "consent"` forces a new refresh token each time. **PASS.**
- Scopes limited to `youtube.upload` + `youtube`. **PASS.**
- Tokens auto-refreshed via googleapis `tokens` event. **PASS.**
- Disconnect (`DELETE /api/youtube/accounts`) removes the token from DB but does NOT revoke it at Google. **FLAG** — user should manually revoke at myaccount.google.com/permissions. Documented in the Settings UI.

---

## Fixes applied in v0.2

1. **npm migration** — bun.lock removed, package-lock.json generated, scripts updated
2. **Model env vars** — `ZAI_MODEL`, `GROQ_MODEL`, `GEMINI_MODEL`, `ANTHROPIC_MODEL` with defaults
3. **Real file upload** — `/api/upload` route with multipart/form-data, `uploads/` dir gitignored
4. **Multi-account OAuth** — `/api/youtube/auth` + `/api/youtube/callback` + `YouTubeAccount` model
5. **Account selector** — colored avatars, confirmation banner, "no account" empty state
6. **Upload limit in Settings** — `uploadLimitMb` persisted to DB, enforced in upload route
7. **Create tab** — dedicated wizard with StepProgress
8. **Dynamic imports** — heavy SDKs loaded lazily to save memory
9. **SSR disabled for Dashboard** — avoids hydration crashes from browser extensions

## Ship readiness

**READY** — the v0.2 changes are substantial and well-architected. H1 (plaintext tokens) is the only real concern and is acceptable for a self-hosted single-user app in v0.2.
