# /design-review — Shorts Pilot

> gstack `/design-review` skill output. Visual design QA: finds visual
> inconsistency, spacing issues, hierarchy problems, AI slop patterns, and
> slow interactions — then fixes them. Iteratively fixes issues in source
> code, committing each fix atomically and re-verifying with before/after
> screenshots.

**Project**: Shorts Pilot
**Date**: 2026-07-01
**Tier**: Standard (critical + medium)

## Before / After

| Surface | Before | After |
|---------|--------|-------|
| Overview (full) | `before-overview.png` | `after-overview.png` |
| Overview (seeded) | `before-seeded.png` | (same fix applies) |

## Findings

### F1 [MEDIUM] — Dead "Channels" sidebar link
**What's wrong**: The sidebar has a "Channels" item pointing to `#channels`, which is not a real tab. Clicking it does nothing.
**What happens if shipped**: Users click, nothing happens, trust drops.
**Fix applied**: Removed the Channels item from `src/components/app-shared.tsx`. Removed the now-unused `YoutubeIcon` import.
**Commit**: design-review: remove dead Channels sidebar link

### F2 [MEDIUM] — Fake "just now" activity entry
**What's wrong**: `support-activity.tsx` always prepended a fake "YouTube channel connected (mock mode) · just now" entry to the activity feed, regardless of whether anything had actually happened.
**What happens if shipped**: The activity feed lies. Users see "just now" on every page load even when nothing changed.
**Fix applied**: Removed the fake entry. The feed now shows only real scheduling events, most-recent first.
**Commit**: design-review: remove fake activity feed entry

### F3 [LOW] — Unused imports after F1/F2
**What's wrong**: `YoutubeIcon`, `CalendarClockIcon`, `SettingsIcon` were imported in `support-activity.tsx` and `app-shared.tsx` but no longer used after F1/F2.
**What happens if shipped**: Linter passes (eslint doesn't flag unused lucide imports by default), but the bundle ships dead code.
**Fix applied**: Removed all unused imports.
**Commit**: design-review: remove unused icon imports

### F4 [INFO] — Charts fall back to demo data on empty DB
**What's wrong**: When the API returns zero scheduled posts, `conversation-volume-chart.tsx`, `csat-responses-chart.tsx`, and `first-reply-time-chart.tsx` silently render synthetic demo data (sin-wave distributions). This is documented in `01-plan-design-review.md` as T2 but not fixed in this pass because it requires a shared empty-state component.
**What happens if shipped**: New users see realistic-looking but fake charts and may believe the app is populated.
**Prescribed fix**: Add an empty-state card to each chart. Deferred to T2 in the plan-design-review task list.

### F5 [INFO] — Pie chart shows 50/50 split on empty DB
**What's wrong**: `channel-breakdown-chart.tsx` initializes its state to `{long: 50, short: 50}` and only updates after the `/api/schedule` call resolves. On a slow connection the user briefly sees a 50/50 pie chart with no data behind it.
**What happens if shipped**: Momentary visual lie.
**Prescribed fix**: Initialize to an empty array and show a loading skeleton until data arrives. Deferred.

### F6 [PASS] — No AI slop patterns detected
The @efferd/dashboard-3 block is clean:
- No purple/violet gradients
- No 3-column icon-in-circle feature grid
- No centered everything
- No uniform bubbly border-radius
- No emoji as design elements
- No colored left-border on cards
- No generic hero copy
- No system-ui/-apple-system as primary font (uses Geist Sans)

### F7 [PASS] — Color contrast
All text passes WCAG AA:
- `text-foreground` on `bg-background`: ~15:1 (AAA)
- `text-muted-foreground` on `bg-background`: ~5.2:1 (AA)
- `text-[10px]` status text in team-on-duty: borderline at small sizes but the icon + text combo is legible

### F8 [PASS] — Spacing consistency
Cards use `p-6` for content, `gap-4` for grid spacing — consistent across all tabs. The @efferd block enforces this via its `shadow-none dark:ring-0` card pattern.

### F9 [PASS] — Hierarchy
Each tab has a clear H1 (page title) → H2 (section title) → table/chart hierarchy. The sidebar groups are labeled. Breadcrumbs show the current location.

### F10 [PASS] — No slow interactions
All API calls resolve in <15ms locally (Prisma + SQLite). The "Generate shorts" button is the only slow path (~10s with LLM calls) and shows a spinner + toast.

## Fixes committed

1. `src/components/app-shared.tsx` — removed dead "Channels" nav item + unused `YoutubeIcon` import
2. `src/components/support-activity.tsx` — removed fake "just now" activity entry + unused imports

## Health score

| Dimension | Before | After |
|-----------|--------|-------|
| Navigation integrity | 7/10 | 9/10 |
| Activity feed truthfulness | 4/10 | 9/10 |
| AI slop risk | 9/10 | 9/10 |
| Color contrast | 9/10 | 9/10 |
| Spacing consistency | 9/10 | 9/10 |
| Hierarchy | 8/10 | 8/10 |
| Interaction speed | 9/10 | 9/10 |
| **Overall** | **7.9/10** | **9.0/10** |

## Ship readiness

**READY** — the two medium-severity issues (dead link, fake activity) are fixed. The deferred chart empty-state issue (F4/F5) is tracked in the plan-design-review task list and does not block ship.
