# Contributing to Shorts Pilot

Thanks for your interest in contributing! This is a small project, so the
process is lightweight.

## Project conventions

### Branch + commit

- Branch from `main`. Name branches `feat/...`, `fix/...`, `docs/...`.
- Commit messages: `type: imperative summary` (e.g. `feat: add thumbnail upload`,
  `fix: shorts dedup on regenerate`, `docs: add deploy guide`).
- Keep commits atomic — one logical change per commit.

### Code style

- TypeScript throughout. Strict mode is on.
- Use existing shadcn/ui components; don't add new UI libraries.
- Server-only code (anything that imports `googleapis`, `@google/genai`,
  `@anthropic-ai/sdk`, `openai`, or `z-ai-web-dev-sdk`) must live in
  `src/lib/` and only be imported from `src/app/api/*/route.ts` or other
  server-only libs.
- Client-safe constants go in `*-shared.ts` files (`beats.ts`,
  `llm-shared.ts`, `youtube-shared.ts`). Never import a Node-only SDK
  from a file in `src/components/`.
- Use the existing `toast` (sonner) for user feedback. Never use `alert()`.
- Use the existing Zustand store (`useDashboardStore`) for cross-component
  state. Call `bumpRefresh()` after any mutation so charts refetch.

### Database changes

1. Edit `prisma/schema.prisma`.
2. Run `bun run db:push` to apply.
3. Run `bun run db:generate` to regenerate the client.
4. Commit both `schema.prisma` and any migration files.

### Adding a new LLM provider

1. Add the provider name to `ProviderName` in `src/lib/llm-shared.ts`.
2. Add it to `PROVIDER_ORDER`, `PROVIDER_LABELS`, `PROVIDER_MODELS`.
3. Add a `call<Provider>()` function in `src/lib/llm.ts`.
4. Add it to the `switch` in `callProvider()`.
5. Add the env key check to `getConfiguredProviders()`.
6. Add the key to `.env.example` and `README.md`.

### Adding a new API route

1. Create `src/app/api/<name>/route.ts`.
2. Export `GET` and/or `POST` async functions.
3. Use `import { db } from "@/lib/db"` for database access.
4. Return `NextResponse.json(...)` — never raw `Response`.
5. Handle errors with try/catch and return `{ error: message }` with
   appropriate status codes.

### Testing

There are currently no automated tests (tracked as T2 in
`docs/reviews/03-plan-devex-review.md`). If you're adding a feature,
please also add a test for the core logic in `src/lib/`. Use Bun's test
runner (`bun test`).

### Linting

```bash
bun run lint
```

Must pass with zero errors before opening a PR.

## Pull requests

1. Open a PR against `main`.
2. Include a clear description of what changed and why.
3. If your change adds a new env key, update `.env.example` and `README.md`.
4. If your change affects the database, note the migration in the PR body.
5. If your change affects the UI, include a before/after screenshot.

## Reporting bugs

Open an issue with:
- What you expected.
- What actually happened.
- Steps to reproduce.
- Your `.env` configuration (redact secret values).
- Browser + OS.

## Security

If you find a security issue, please do NOT open a public issue. Email
the maintainer directly.

Never commit `.env`, API keys, OAuth tokens, or refresh tokens. The
`.gitignore` already excludes `.env` — double-check with `git status`
before pushing.
