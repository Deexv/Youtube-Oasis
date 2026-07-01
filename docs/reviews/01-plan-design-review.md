# /plan-design-review — Shorts Pilot v0.2

> gstack `/plan-design-review` skill output. Rates each design dimension
> 0-10, explains what would make it a 10, then prescribes the fix.

**Project**: Shorts Pilot — YouTube long-form + AI shorts scheduler
**Version**: 0.2.0 (multi-account, real uploads, npm, model env vars)
**Date**: 2026-07-01

---

## Initial design rating

**Overall: 8/10** — the v0.2 changes addressed the biggest v0.1 gaps (real
uploads, account selector, Create tab, progress bars). The remaining issues
are polish-level.

A 10/10 would: (1) show the account color consistently across every tab,
(2) make the Create wizard's progress steps reflect real server state, and
(3) add empty states to every chart.

---

## Pass 1 — Information Architecture: 8/10 → 9/10

**Why 8**: The new "Create" tab in position 2 (after Overview) is the right
call — it's the primary action. The sidebar groups are logical: Content
(Create, Long-form, Shorts) → Schedule (Upcoming) → Workspace (Settings).

**Improvement**: The "New long-form" button in the header is now redundant
with the Create tab. Consider removing it or making it open the Create tab
instead of the old dialog.

## Pass 2 — Interaction State Coverage: 7/10 → 9/10

**Why 7**: The Create wizard now shows a multi-step progress indicator
(StepProgress component) for both long-form upload and shorts generation.
The file uploader shows live upload %. The account selector shows a clear
"no account connected" state with a CTA.

**Remaining gap**: The chart components still fall back to demo data when
the API returns empty. Prescribed in v0.1 review as T2 — still open.

**New strength**: The account selector's colored confirmation banner
("Posting as [Channel Name]") is a strong anti-mistake pattern.

## Pass 3 — User Journey & Emotional Arc: 8/10 → 9/10

**Why 8**: The first-run experience is now guided — the Create tab shows
the file uploader immediately, and if no YouTube account is connected, the
account selector prompts "Connect YouTube account" with a direct link to
the OAuth flow.

**Improvement**: The OAuth redirect returns to `/settings`, not `/create`.
The user has to navigate back to Create after connecting. Fix: pass
`returnTo=/create` in the auth URL (already supported by the API).

## Pass 4 — AI Slop Risk: 8/10

**Why 8**: The @efferd block remains clean. The new account selector uses
colored dots (not icon-in-circle patterns). The StepProgress component is
minimal and functional.

**Pass** — no slop patterns introduced.

## Pass 5 — Design System Alignment: 8/10

**Why 8**: All new components (FileUploader, YouTubeAccountSelector,
StepProgress, CreatePanel) use shadcn/ui primitives consistently. The
account color palette is hardcoded in youtube.ts but could be promoted to
a design token.

## Pass 6 — Responsive & Accessibility: 7/10 → 8/10

**Why 7**: The Create tab's two-column mode selector (Long-form / Shorts)
stacks correctly on mobile. The file uploader's drag-and-drop area is
large enough for touch. The account selector dropdown shows color dots +
avatar + name — readable on mobile.

**Remaining**: The StepProgress component's step labels are small text
(`text-sm`). On mobile they could be tighter. Minor.

## Pass 7 — Unresolved Design Decisions: 7/10 → 8/10

| Decision | Status |
|----------|--------|
| D1. Shorts regeneration (append vs replace) | Still deferred — T8 from v0.1 |
| D2. Per-video vs global scheduling window | Resolved — per-video with global default |
| D3. YouTube quota error handling | Improved — account selector catches "no account" early |
| D4. "Channels" sidebar link | Resolved — removed in v0.1 |
| D5. LLM key UI editing | Resolved — keys are env-only, models shown in UI |
| D6 (new). OAuth return URL | Should return to /create, not /settings |
| D7 (new). Account color consistency | Color should appear on every tab where the account is used |

---

## Implementation Tasks (v0.2 delta)

- [ ] **T1 (P2)** — Create — remove redundant "New long-form" header button OR make it switch to Create tab
- [ ] **T2 (P1, carried)** — Charts — show empty state instead of demo data
- [ ] **T3 (P2)** — OAuth — change return URL from /settings to /create when triggered from Create
- [ ] **T4 (P3)** — Account color — show the colored dot on Long-form and Shorts table rows
- [ ] **T5 (P3)** — StepProgress — make step labels responsive on mobile

## Completion Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  GSTACK PLAN-DESIGN-REVIEW — Shorts Pilot v0.2                  │
├─────────────────────────────────────────────────────────────────┤
│  Initial design score:  8/10                                    │
│  Overall after fixes:   9/10                                    │
│                                                                 │
│  Pass 1 — Information Architecture:    8 → 9                    │
│  Pass 2 — Interaction State Coverage:  7 → 9                    │
│  Pass 3 — User Journey & Emotional:    8 → 9                    │
│  Pass 4 — AI Slop Risk:                8 → 8                    │
│  Pass 5 — Design System Alignment:     8 → 8                    │
│  Pass 6 — Responsive & Accessibility:  7 → 8                    │
│  Pass 7 — Unresolved Decisions:        7 → 8                    │
└─────────────────────────────────────────────────────────────────┘
```

NO UNRESOLVED DECISIONS blocking ship.
