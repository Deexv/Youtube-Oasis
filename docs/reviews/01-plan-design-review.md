# /plan-design-review — Shorts Pilot

> gstack `/plan-design-review` skill output, adapted for autonomous execution.
> Rates each design dimension 0-10, explains what would make it a 10, then
> prescribes the fix. The output of this skill is a better plan, not a
> document about the plan.

**Project**: Shorts Pilot — YouTube long-form + shorts scheduler
**Branch**: main
**Reviewed surface**: `src/components/*`, `src/app/page.tsx`, `src/app/layout.tsx`
**Date**: 2026-07-01

---

## Step 0 — Scope gate

- **Review target**: C) the current implementation (live UI on `localhost:3000`).
- **Plan source**: the existing `src/components/dashboard.tsx` tab structure plus the five tab panels (Overview, Long-form, Shorts, Upcoming, Settings).
- **UI scope confirmed**: yes — the project is a dashboard with multiple screens, forms, tables, and dialogs.

## Initial design rating

**Overall: 6/10** — functional, the @efferd/dashboard-3 block gives a strong baseline, but several interaction states are missing and a few screens lean on demo data without a clear empty-state path.

A 10/10 for this plan would:
1. Specify loading / empty / error / success states for every data-driven surface.
2. Have a real information hierarchy on every tab (primary action visible without scrolling).
3. Show the live/mock + provider status on the Overview, not just Settings.
4. Make the "Generate shorts" action show progress, not just a spinner + toast.
5. Treat the upcoming schedule timeline as the dashboard hero, not a tab.

---

## Pass 1 — Information Architecture: 5/10 → 8/10

**Why 5**: The sidebar groups "Overview / Long-form / Shorts / Upcoming / Settings" flat. The Overview tab is a 4-column chart grid that buries the most important signal (what's posting next) below volume charts. The Upcoming tab — which is the actual product answer to "when am I posting?" — is hidden behind a click.

**What 10 looks like**: the next scheduled post is the first thing the user sees on Overview, above the fold, on every device. Charts come second.

**Fix applied**: documented in `docs/reviews/01-plan-design-review.md` (this file). Implementation task T1 below.

**After fix (prescribed)**: 8/10 — the chart grid stays, but a "Next post" hero card is promoted to the top of the Overview tab, and the Upcoming tab gets a sidebar badge showing the count of pending posts.

```
ASCII — proposed Overview hierarchy (desktop):

┌─────────────────────────────────────────────────────────────────┐
│  Next post:  Long-form "Deep Work in a Noisy World"              │
│              Today 14:21 · in 3h 12m · YouTube scheduled         │
│  [ View schedule ]  [ Generate shorts ]                          │
└─────────────────────────────────────────────────────────────────┘
┌──────────────┬──────────────┬──────────────┬─────────────────────┐
│ Long sched 4 │ Shorts 18   │ Headroom 2   │ Avg gap 2.3h        │
└──────────────┴──────────────┴──────────────┴─────────────────────┘
┌───────────────────────────────┬──────────────────────────────────┐
│ Schedule volume (area)         │ Long vs Shorts split (pie)       │
└───────────────────────────────┴──────────────────────────────────┘
┌────────────────────────────────┬─────────────────────────────────┐
│ Posts per day (stacked bars)   │ Long-form queue + gen shorts     │
└────────────────────────────────┴─────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────┐
│ Upcoming posts table (next 6)                                    │
└──────────────────────────────────────────────────────────────────┘
```

## Pass 2 — Interaction State Coverage: 3/10 → 7/10

**Why 3**: Most components only handle the "loaded with data" state. The recent-conversations table shows an empty-state row, but the charts silently render demo data when the API returns `[]`. The "Generate shorts" button shows a spinner but no progress. Failed YouTube uploads are stored as `status: "failed"` with no user-visible retry path.

**Interaction state matrix**:

| Feature | Loading | Empty | Error | Success | Partial |
|---------|---------|-------|-------|---------|---------|
| Overview charts | skeleton (partial) | demo data (wrong) | crash | ok | n/a |
| Long-form table | none | ok (empty row) | none | ok | n/a |
| Shorts table | none | ok (empty row) | none | ok | n/a |
| Upcoming timeline | none | ok | none | ok | n/a |
| New long-form dialog | button spinner | n/a | toast error | toast ok | n/a |
| Generate shorts | button spinner | n/a | toast error | toast ok | no progress |
| Settings save | button spinner | n/a | toast error | toast ok | n/a |

**Fix**: T2, T3 below. Charts should show a "No data yet" empty card when the API returns zero rows, not silently fall back to demo data.

## Pass 3 — User Journey & Emotional Arc: 6/10 → 8/10

**Why 6**: The happy path works (seed → generate shorts → see them scheduled). But the first-run experience is barren: a new user lands on Overview with zero data and no clear next step. The "Seed demo data" button is buried in the Upcoming tab.

**Journey**:

| Step | User does | User feels | Plan specifies? |
|------|-----------|------------|-----------------|
| 1. Land on Overview | sees empty charts | confused | no |
| 2. Find seed button | clicks Upcoming tab | mild friction | no |
| 3. Seed data | watches toast | relieved | yes |
| 4. Add own long-form | opens dialog | engaged | yes |
| 5. Generate shorts | waits ~10s | anxious (no progress) | partial |
| 6. See shorts scheduled | switches to Shorts tab | satisfied | yes |
| 7. Configure providers | opens Settings | overwhelmed (4 keys) | partial |

**Fix**: T4 — add a first-run empty state on Overview with a single primary CTA ("Add your first long-form video" or "Seed demo data").

## Pass 4 — AI Slop Risk: 7/10 → 8/10

**Why 7**: The @efferd block is well-designed (no purple gradients, no icon-in-circle grid, no emoji-as-design). But three patterns need scrutiny:

1. The stats cards use 4 identical card shapes — this is fine for KPIs but risks reading as a "feature grid" if the labels are vague. Current labels ("Long-form scheduled", "Shorts scheduled", "Daily shorts headroom", "Next post") are specific enough. **OK.**
2. The pie chart at 50/50 default state with the label "Long vs Shorts split" is a generic-looking chart. When there's no data it should show an empty state, not a 50/50 split. **Flag.**
3. The "Workspace activity" feed shows "YouTube channel connected (mock mode)" with time "just now" — this is fake activity. It should either reflect real events or be removed. **Flag.**

**AI Slop blacklist check**: none of the 10+1 patterns (purple gradients, 3-col icon grid, centered everything, etc.) are present. **Pass.**

## Pass 5 — Design System Alignment: 7/10

**Why 7**: The project uses shadcn/ui with the `new-york` style and `neutral` base color. There is no `DESIGN.md`. The @efferd block brought its own `delta`, `indicator`, `formater` primitives which are consistent with shadcn.

**Fix**: T5 — create a `DESIGN.md` documenting the color tokens, spacing scale, and component conventions so future contributors don't drift.

## Pass 6 — Responsive & Accessibility: 6/10 → 8/10

**Why 6**:
- Tables hide columns on small screens (`hidden md:table-cell`) which is correct, but the primary action ("Generate shorts") is only visible `sm:inline`. On mobile the button still renders but the text is hidden, leaving an icon-only button without an aria-label. **Flag.**
- The "New long-form" dialog has `max-h-[90vh] overflow-y-auto` — good. But the form labels are not associated with their inputs via `htmlFor` on every field (some are, some aren't). **Partial.**
- Touch targets: most buttons are `size="sm"` (~32px). The `icon-xs` dropdown triggers are 28px. Both are below the 44px minimum for touch. **Flag for mobile.**
- Color contrast: the `text-muted-foreground` on `bg-background` passes AA but the `text-[10px]` status text in team-on-duty is borderline. **Flag.**
- Keyboard nav: tabs are keyboard accessible (Radix). Dialogs trap focus (Radix). Tables are not keyboard-navigable row-by-row but that's acceptable for a data table. **OK.**

**Fix**: T6, T7.

## Pass 7 — Unresolved Design Decisions: 4/10 → 7/10

**Decisions that will haunt implementation**:

| Decision | If deferred, what happens |
|----------|---------------------------|
| D1. Should shorts be re-generatable (overwrite) or append-only? | Currently append-only — re-running "Generate shorts" on the same long-form creates duplicates. User will be confused. |
| D2. Should the scheduling window be per-video or global? | Currently per-video with a global default in Settings. Reasonable, but the dialog doesn't make this clear. |
| D3. What happens when YouTube quota is exceeded? | The API returns 403, the short is marked `failed`, no retry. User sees a `failed` badge with no explanation. |
| D4. Should the "Channels" sidebar link do anything? | Currently a dead `href="#channels"` that goes nowhere. |
| D5. Should the LLM provider keys be editable from the UI? | Settings shows inputs but they're not wired to a save endpoint — they're display-only. |

**Fix**: T8, T9, T10.

---

## NOT in scope

- Multi-user / team collaboration (single-user scheduler for now).
- YouTube Analytics import (would require additional OAuth scopes).
- Video transcoding / format conversion (assumes upload-ready MP4).
- Mobile-native app (responsive web only).

## What already exists

- shadcn/ui component library (New York style, neutral palette) — 60+ components in `src/components/ui/`.
- @efferd/dashboard-3 block — sidebar, header, breadcrumbs, stats, charts, tables, activity feed.
- Prisma + SQLite — `LongFormVideo`, `Short`, `Setting` models.
- Real YouTube Data API v3 integration (`src/lib/youtube.ts`) — `videos.insert` with `publishAt`.
- Multi-provider LLM layer (`src/lib/llm.ts`) — Z.AI, Groq, Gemini, Claude with rotation.
- 6-beat narrative pattern for moment detection (`src/lib/beats.ts`).

## TODOS.md updates

| What | Why | Pros | Cons | Recommendation |
|------|-----|------|------|----------------|
| Add first-run empty state on Overview | New users see blank charts | Lowers bounce, guides to first action | One more component to maintain | Add to TODOS.md |
| Wire Settings LLM key inputs to a save endpoint | Currently display-only | Lets users update keys without restart | Requires a secure secrets store | Skip — .env is the right place for secrets |
| Add "Channels" page or remove the link | Dead link in sidebar | Either completes the nav or removes confusion | Small effort either way | Build it now (remove the link) |

## Implementation Tasks

- [ ] **T1 (P2, human: ~1h / CC: ~5min)** — Overview — promote "Next post" hero card above the stats row
  - Surfaced by: Pass 1 — Information Architecture
  - Files: `src/components/dashboard.tsx`, new `src/components/next-post-hero.tsx`
  - Verify: Overview shows the next scheduled post above the fold on desktop and mobile

- [ ] **T2 (P1, human: ~2h / CC: ~15min)** — Charts — show "No data yet" empty state instead of demo data when API returns `[]`
  - Surfaced by: Pass 2 — Interaction State Coverage
  - Files: `src/components/conversation-volume-chart.tsx`, `src/components/csat-responses-chart.tsx`, `src/components/first-reply-time-chart.tsx`, `src/components/channel-breakdown-chart.tsx`
  - Verify: with empty DB, charts show an empty-state card, not fake numbers

- [ ] **T3 (P2, human: ~1h / CC: ~10min)** — Generate shorts — show per-beat progress (1/6, 2/6, …)
  - Surfaced by: Pass 2 + Pass 3
  - Files: `src/components/team-on-duty.tsx`, `src/components/long-form-panel.tsx`, `src/app/api/shorts/generate/route.ts` (switch to streaming)
  - Verify: button shows "Generating 3/6…" while running

- [ ] **T4 (P1, human: ~1h / CC: ~10min)** — Overview — first-run empty state with CTA
  - Surfaced by: Pass 3 — User Journey
  - Files: `src/components/dashboard.tsx`
  - Verify: fresh DB shows "Add your first long-form video" + "Seed demo data" buttons

- [ ] **T5 (P2, human: ~30min / CC: ~5min)** — Docs — create `DESIGN.md`
  - Surfaced by: Pass 5
  - Files: `DESIGN.md`
  - Verify: file exists, documents color tokens, spacing, component conventions

- [ ] **T6 (P2, human: ~30min / CC: ~5min)** — A11y — add aria-labels to icon-only buttons
  - Surfaced by: Pass 6
  - Files: `src/components/team-on-duty.tsx`, `src/components/app-header.tsx`
  - Verify: axe-core scan shows no "button without accessible name" violations

- [ ] **T7 (P3, human: ~1h / CC: ~10min)** — Mobile — increase touch targets to 44px on primary actions
  - Surfaced by: Pass 6
  - Files: `src/components/ui/button.tsx` (add `size="touch"` variant)
  - Verify: mobile viewport, tap targets are ≥44px

- [ ] **T8 (P1, human: ~1h / CC: ~10min)** — Shorts — prevent duplicate generation (confirm or replace)
  - Surfaced by: Pass 7 — D1
  - Files: `src/components/team-on-duty.tsx`, `src/app/api/shorts/generate/route.ts`
  - Verify: clicking "Generate shorts" on a long-form that already has shorts asks to replace

- [ ] **T9 (P2, human: ~15min / CC: ~3min)** — Sidebar — remove dead "Channels" link
  - Surfaced by: Pass 7 — D4
  - Files: `src/components/app-shared.tsx`
  - Verify: sidebar no longer has a Channels link

- [ ] **T10 (P2, human: ~30min / CC: ~5min)** — Shorts — surface YouTube quota errors with a retry button
  - Surfaced by: Pass 7 — D3
  - Files: `src/components/shorts-panel.tsx`, `src/app/api/youtube/schedule/route.ts`
  - Verify: a failed short shows "Retry" next to the status badge

## Completion Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  GSTACK PLAN-DESIGN-REVIEW — Shorts Pilot                       │
├─────────────────────────────────────────────────────────────────┤
│  Initial design score:  6/10                                    │
│  Overall after fixes:   8/10                                    │
│                                                                 │
│  Pass 1 — Information Architecture:    5 → 8                    │
│  Pass 2 — Interaction State Coverage:  3 → 7                    │
│  Pass 3 — User Journey & Emotional:    6 → 8                    │
│  Pass 4 — AI Slop Risk:                7 → 8                    │
│  Pass 5 — Design System Alignment:     7 → 8                    │
│  Pass 6 — Responsive & Accessibility:  6 → 8                    │
│  Pass 7 — Unresolved Decisions:        4 → 7                    │
│                                                                 │
│  Decisions made:     0 (autonomous run — no AskUserQuestion)    │
│  Decisions deferred: 5 (D1-D5 above)                            │
│  Tasks emitted:      10 (4×P1, 5×P2, 1×P3)                     │
└─────────────────────────────────────────────────────────────────┘
```

## VERDICT

The dashboard is functional and visually solid thanks to the @efferd block. The biggest risk is **interaction state coverage** — charts silently show demo data when the DB is empty, which will mislead users into thinking the app is populated. Fix T2 first. The second risk is **first-run experience** — a new user lands on an empty Overview with no guidance. Fix T4.

## Unresolved decisions

**UNRESOLVED DECISIONS:**
- D1: shorts regeneration behavior (append vs replace) — deferred, T8 prescribes "confirm to replace"
- D2: per-video vs global scheduling window — current design (per-video with global default) is kept
- D3: YouTube quota error handling — deferred, T10 prescribes retry button
- D4: "Channels" sidebar link — deferred, T9 prescribes removal
- D5: LLM key UI editing — deferred, .env remains the source of truth

NO CONSENSUS NEEDED — all deferred decisions have a prescribed fix in the task list.
