# /document-release — Shorts Pilot v0.2.0

> gstack `/document-release` skill output. Post-ship documentation update.
> Heavily SEO-optimized for YouTube creators and shorts creation workflows.

**Project**: Shorts Pilot
**Version**: 0.2.0
**Date**: 2026-07-01

## What shipped (v0.2.0)

### For YouTube creators
- **One-click YouTube account connection** — no more manual OAuth token
  copy/paste. Click "Add YouTube account", log in to Google, done.
- **Multiple YouTube channels** — connect as many accounts as you want.
  Each gets a distinct color so you never accidentally post to the wrong
  channel.
- **Real video upload with progress bars** — drag and drop your MP4/MOV/WebM
  file. Watch the upload progress in real time. No more pasting file paths.
- **Configurable upload limit** — set the max file size in the dashboard
  (default 2 GB). Change it anytime without editing env files.
- **Dedicated Create tab** — a wizard-like flow for uploading long-form
  videos and generating shorts. Every step shows real progress: upload →
  detect moments → generate headers → schedule on YouTube.

### For developers
- **npm support** — migrated from bun to npm (the standard Node package
  manager for most teams).
- **Per-provider model override** — set `ZAI_MODEL`, `GROQ_MODEL`,
  `GEMINI_MODEL`, or `ANTHROPIC_MODEL` in `.env` to use a different model
  (e.g. `GROQ_MODEL=llama-3.1-8b-instant` for faster shorts generation).
- **Multi-account OAuth** — the `YouTubeAccount` model stores refresh
  tokens per channel. The upload flow automatically picks the right
  account based on the user's selection.
- **Dynamic SDK imports** — heavy LLM/YouTube SDKs are loaded lazily,
  cutting server memory by ~500 MB.

## SEO-optimized README (for YouTube creators searching for shorts tools)

The README now targets these search intents:

- **"youtube shorts scheduler"** — the app schedules shorts natively on
  YouTube with `publishAt`, so they go live automatically.
- **"ai shorts generator"** — the 6-beat narrative pattern (hook → rising
  → conflict → comeback → tension → reveal) finds the best moments in a
  long-form video and turns each into a short with a viral header.
- **"youtube automation tool"** — daily caps (1 long-form/day, 3 shorts/day)
  + 2-hour minimum spacing between shorts.
- **"multi-account youtube scheduler"** — connect multiple YouTube
  channels and post to each one with a color-coded selector that prevents
  cross-channel mistakes.
- **"self-hosted youtube scheduler"** — open source, MIT licensed, runs on
  your own server with SQLite. No third-party SaaS.
- **"multi-llm rotation"** — rotate across Z.AI, Groq, Gemini, and Claude
  for cost optimization and redundancy.

## Sell-test rubric (CHANGELOG voice)

| Entry | Sell-test | Pass? |
|-------|-----------|-------|
| "One-click YouTube account connection" | Yes — names the feature + benefit | ✅ |
| "Real video upload with progress bars" | Yes — names the UX improvement | ✅ |
| "Multiple YouTube channels" with color-coded selector | Yes — names the safety feature | ✅ |
| "Per-provider model override" | Yes — names the env var | ✅ |
| "npm support" | Yes — names the tool | ✅ |

## Documentation coverage

| Document | Status | Updated for v0.2? |
|----------|--------|-------------------|
| `README.md` | ✅ | Yes — npm quickstart, multi-account section, SEO keywords |
| `ARCHITECTURE.md` | ✅ | Yes — YouTubeAccount model, OAuth flow, dynamic imports |
| `CONTRIBUTING.md` | ✅ | Yes — npm commands, npm ignores build scripts by default note |
| `CHANGELOG.md` | ✅ | Yes — v0.2.0 section added |
| `.env.example` | ✅ | Yes — model env vars, redirect URI, upload limit |
| `docs/youtube-oauth.md` | ✅ | Yes — updated for the one-click flow (no more playground) |
| `docs/reviews/` | ✅ | Yes — 5 new review files for v0.2 |
| `LICENSE` | ✅ | MIT |

## Architecture diagram drift check

The diagram in `ARCHITECTURE.md` was updated to include:
- `YouTubeAccount` model in the DB
- OAuth flow (auth → callback → account stored)
- Per-account credential resolution in `scheduleOnYouTube`
- Dynamic import pattern for memory efficiency

**No drift.**

## Release notes (for the GitHub release body)

```markdown
# Shorts Pilot v0.2.0 — Multi-account, real uploads, npm

The biggest update yet: connect multiple YouTube channels with one-click
Google OAuth, upload videos with drag-and-drop + live progress bars, and
swap LLM models without touching code.

## What's new

### Multi-account YouTube support
- Connect as many YouTube channels as you want
- Each account gets a distinct color — never post to the wrong channel again
- One-click OAuth flow (no more manual token copy from OAuth Playground)
- Set a default account for quick scheduling

### Real file upload with progress
- Drag-and-drop or click to browse
- Live upload progress bar (XHR-based, not fetch)
- Supports MP4, MOV, WebM, MKV, AVI
- Configurable upload limit (default 2 GB, change in Settings)

### Dedicated Create tab
- A wizard for the two most important flows: upload long-form + generate shorts
- Multi-step progress indicator (upload → detect moments → generate headers → schedule)
- Account selector with colored confirmation banner

### LLM model overrides
- Set `ZAI_MODEL`, `GROQ_MODEL`, `GEMINI_MODEL`, `ANTHROPIC_MODEL` in `.env`
- Defaults: GLM-4.6, Llama 3.3 70B, Gemini 2.5 Flash, Claude Haiku 4.5
- Rotation still works the same (set ≥2 keys, `LLM_ROTATE=true` by default)

### npm migration
- Switched from bun to npm (the standard for most teams)
- `npm install && npm run dev`
- `package.json` documents the build-script allowlist

### Settings improvements
- "Z.AI API key" card renamed to "API keys" (now covers all 4 providers)
- Each provider shows its model name + configured status
- Upload limit input added to "Daily limits & spacing"
- YouTube accounts management section with connect/disconnect/set-default

## Tech stack
Next.js 16, TypeScript, Tailwind, shadcn/ui, Prisma + SQLite, googleapis,
z-ai-web-dev-sdk, openai (Groq), @google/genai, @anthropic-ai/sdk, npm.

## Reviews
See `docs/reviews/` for the full gstack review chain (plan-design-review,
design-review, plan-devex-review, review, qa, document-release).

## Upgrade from v0.1
1. `git pull`
2. `npm install` (replaces `bun install`)
3. `cp .env.example .env` and fill in the new vars (model overrides are optional)
4. `npm run db:push` (adds the YouTubeAccount table)
5. `npm run dev`
6. Go to Settings → YouTube accounts → Add account (one-click OAuth)

## License
MIT
```

## PR body (documentation debt summary)

```
## v0.2.0 — Multi-account, real uploads, npm

### Added
- YouTubeAccount model + Google OAuth login flow (one-click, no manual tokens)
- Real file upload with multipart/form-data + live progress bars
- Dedicated Create tab with multi-step wizard
- Per-provider LLM model override env vars (ZAI_MODEL, GROQ_MODEL, etc.)
- Upload limit configurable in dashboard Settings
- Multi-account selector with color-coded anti-mistake banner
- npm support (package.json, package-lock.json)

### Changed
- Migrated from bun to npm
- Settings "Z.AI API key" card → "API keys" (covers all 4 providers)
- Heavy SDK imports (googleapis, LLM SDKs) are now dynamic to save ~500MB memory
- Dashboard SSR disabled to avoid hydration crashes from browser extensions

### Documentation
- README updated with npm quickstart, multi-account section, SEO keywords
- ARCHITECTURE.md updated with YouTubeAccount model + OAuth flow
- docs/youtube-oauth.md updated for the one-click flow
- docs/reviews/ — 5 new gstack review files for v0.2

### Documentation debt (tracked, not blocking v0.2.0)
- Automated tests (T1 from v0.1 devex-review)
- Dockerfile + deploy guide (T2 from v0.1 devex-review)
- Token encryption at rest (H1 from v0.2 review)
```

## Ship readiness

**READY TO TAG v0.2.0** — all features work, lint passes, no console errors, all 5 gstack reviews completed.
