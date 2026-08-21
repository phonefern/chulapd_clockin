# Plans registry

Numbered plan documents for Codex to implement from. See each file's own structure (Overview → Scope → Data model → Files → Verification checklist). Update the **Status** column as plans move through review → implemented.

| Plan | File | Status | Description |
|---|---|---|---|
| PLAN-001 | [PLAN_001_BRANDING.md](./PLAN_001_BRANDING.md) | Implemented | Rename app to "ChulaPD Attendance" in metadata + UI headers; wire in the generated logo mark (`public/logo-mark.svg`, `src/app/icon.png`, `src/app/apple-icon.png`); drop old default favicon |
| PLAN-002 | [PLAN_002_ADMIN_LIVE_REFRESH_AND_DATE_FILTER.md](./PLAN_002_ADMIN_LIVE_REFRESH_AND_DATE_FILTER.md) | Implemented | `/admin` gains a date picker (`?date=`) + polling auto-refresh (15s, today-only, pauses when tab hidden) — rejects Supabase Realtime as a mismatch with the custom admin-session cookie auth model |
| PLAN-003 | [PLAN_003_ADMIN_STATS_DASHBOARD.md](./PLAN_003_ADMIN_STATS_DASHBOARD.md) | Implemented | New `/admin/stats` page: 7d/30d/custom range, KPI cards, headcount + avg-hours bar charts (shadcn `chart.tsx` + recharts), per-employee range summary table |
| PLAN-004 | [PLAN_004_EMPLOYEES_PAGE_ENHANCEMENTS.md](./PLAN_004_EMPLOYEES_PAGE_ENHANCEMENTS.md) | Implemented | `/admin/employees` gains search, sortable columns, a "today's status" column, and a Card-wrapped layout to match `/admin`'s polish. Explicitly rejects manual employee pre-registration (doesn't merge cleanly with the LINE-login upsert) |
| PLAN-005 | [PLAN_005_PREVENT_ACCIDENTAL_EARLY_CLOCK_OUT.md](./PLAN_005_PREVENT_ACCIDENTAL_EARLY_CLOCK_OUT.md) | Implemented | Confirmation dialog on clock-out before 16:00 (30 min before standard 16:30 end-of-day) + 2-minute undo window. Explicitly rejects building the full `attendance_adjustments` request/approve workflow now — schema exists, zero UI/API touches it yet, seeded as a future plan |

## Suggested implementation order

1. **PLAN-001** (branding) — small, independent, low risk, sets the visual baseline the others build on
2. **PLAN-002** (admin live refresh + date filter) — touches `/admin/page.tsx` before PLAN-003 adds a nav link there
3. **PLAN-004** (employees polish) — independent of 002/003 beyond the nav link, can run in parallel
4. **PLAN-003** (stats page) — depends on 002's date-parsing convention
5. **PLAN-005** (accidental clock-out) — fully independent, can run anytime

## Conventions

- Plans are written in English (Codex consumes them); Thai only inside literal UI strings shown to end users.
- Each plan is opinionated — one recommended approach, alternatives noted only when explicitly rejected with a reason.
- "Out of scope" sections are load-bearing — they exist to stop scope creep, not as filler.
- When a plan is implemented, update its Status here (and in the plan file's own header if it has one) rather than deleting the file — they're a historical record of decisions, same as this project's `docs/` mirrors the checkpd-admin project's convention.
