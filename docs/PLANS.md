# Plans registry

Numbered plan documents for Codex to implement from. See each file's own structure (Overview → Scope → Data model → Files → Verification checklist). Update the **Status** column as plans move through review → implemented.

| Plan | File | Status | Description |
|---|---|---|---|
| PLAN-001 | [PLAN_001_BRANDING.md](./PLAN_001_BRANDING.md) | Implemented | Rename app to "ChulaPD Attendance" in metadata + UI headers; wire in the generated logo mark (`public/logo-mark.svg`, `src/app/icon.png`, `src/app/apple-icon.png`); drop old default favicon |
| PLAN-002 | [PLAN_002_ADMIN_LIVE_REFRESH_AND_DATE_FILTER.md](./PLAN_002_ADMIN_LIVE_REFRESH_AND_DATE_FILTER.md) | Implemented | `/admin` gains a date picker (`?date=`) + polling auto-refresh (15s, today-only, pauses when tab hidden) — rejects Supabase Realtime as a mismatch with the custom admin-session cookie auth model |
| PLAN-003 | [PLAN_003_ADMIN_STATS_DASHBOARD.md](./PLAN_003_ADMIN_STATS_DASHBOARD.md) | Implemented | New `/admin/stats` page: 7d/30d/custom range, KPI cards, headcount + avg-hours bar charts (shadcn `chart.tsx` + recharts), per-employee range summary table |
| PLAN-004 | [PLAN_004_EMPLOYEES_PAGE_ENHANCEMENTS.md](./PLAN_004_EMPLOYEES_PAGE_ENHANCEMENTS.md) | Implemented | `/admin/employees` gains search, sortable columns, a "today's status" column, and a Card-wrapped layout to match `/admin`'s polish. Explicitly rejects manual employee pre-registration (doesn't merge cleanly with the LINE-login upsert) |
| PLAN-005 | [PLAN_005_PREVENT_ACCIDENTAL_EARLY_CLOCK_OUT.md](./PLAN_005_PREVENT_ACCIDENTAL_EARLY_CLOCK_OUT.md) | Implemented | Confirmation dialog on clock-out before 16:00 (30 min before standard 16:30 end-of-day) + 2-minute undo window. Explicitly rejects building the full `attendance_adjustments` request/approve workflow now — schema exists, zero UI/API touches it yet, seeded as a future plan |
| PLAN-006 | [PLAN_006_MONTHLY_EXPORT_AND_PRINT.md](./PLAN_006_MONTHLY_EXPORT_AND_PRINT.md) | Implemented; **amended** (per-employee export filter) | New `/admin/export`: monthly daily-ledger table (one row per employee per work day), CSV download (UTF-8 BOM for Excel Thai text) + browser print-to-sign view with a signature line. **Amendment**: `?employee=` filter to export a single employee instead of always all-employees (`getMonthlyAttendanceLedger` gains optional `employeeId` param) |
| PLAN-007 | [PLAN_007_EMPLOYEE_SELF_STATS.md](./PLAN_007_EMPLOYEE_SELF_STATS.md) | Ready | LIFF app gains an in-page "ประวัติของฉัน" toggle (no new route — avoids re-triggering `liff.init()`) showing the employee's own monthly days-present/hours/on-time stats. Introduces shared `getEmployeeMonthSummary()` helper that [[PLAN-008]] also calls |
| PLAN-008 | [PLAN_008_LINE_OA_KEYWORD_REPLY.md](./PLAN_008_LINE_OA_KEYWORD_REPLY.md) | Ready (depends on 007's shared helper) | Extends the existing `follow`-only webhook with a `message`/text branch: `วันนี้`/`เดือนนี้` reply with status/aggregate summary; `สรุป` replies with a **full day-by-day ledger for the month** (every calendar day, in/out times or "ไม่มาทำงาน"). No free-text NLU by design |
| PLAN-009 | [PLAN_009_PRE_SHIFT_REMINDERS.md](./PLAN_009_PRE_SHIFT_REMINDERS.md) | Ready (Cloud Scheduler jobs already created, pending route deploy) | Unconditional "10 minutes left" nudge to all active employees at 08:20 and 16:20 Bangkok (Mon–Fri), on top of the existing conditional late/forgot reminders. **Uses GCP Cloud Scheduler** (project `checkpd`, `asia-southeast1`, native `Asia/Bangkok` timezone) instead of Vercel Cron — Hobby plan cron precision is only ±59min (confirmed via Vercel docs). Jobs `chulapd-clockin-pre-shift-start`/`-end` are live in GCP already; only the new route + refactor of `late-clock-in`/`forgot-clock-out` into shared audience-query helpers go through Codex |
| PLAN-010 | [PLAN_010_ADMIN_MANUAL_ATTENDANCE_EDIT.md](./PLAN_010_ADMIN_MANUAL_ATTENDANCE_EDIT.md) | Ready | Low-visibility ("ปุ่มลับ") icon button per row on `/admin` opens a dialog to directly edit/clear an existing row's clock-in/out times — for "forgot to press" cases. First real writer of the previously schema-only `audit_logs` table (old/new value per edit). Explicitly narrower than, and not a replacement for, the still-deferred `attendance_adjustments` request/approve workflow from [[PLAN-005]] |

## Suggested implementation order

1. **PLAN-001** (branding) — small, independent, low risk, sets the visual baseline the others build on
2. **PLAN-002** (admin live refresh + date filter) — touches `/admin/page.tsx` before PLAN-003 adds a nav link there
3. **PLAN-004** (employees polish) — independent of 002/003 beyond the nav link, can run in parallel
4. **PLAN-003** (stats page) — depends on 002's date-parsing convention
5. **PLAN-005** (accidental clock-out) — fully independent, can run anytime
6. **PLAN-006** (monthly export) — independent of 002/003/005, reuses `workDate.ts` helpers only
7. **PLAN-007** (employee self stats) — independent, but land before 008
8. **PLAN-008** (LINE keyword reply) — depends on 007's `getEmployeeMonthSummary()` helper
9. **PLAN-009** (pre-shift reminders) — independent of 006/007/008, but touches the same two cron routes as the pre-existing late/forgot reminders (refactor, not a rewrite)
10. **PLAN-010** (admin manual attendance edit) — fully independent, can run anytime

## Conventions

- Plans are written in English (Codex consumes them); Thai only inside literal UI strings shown to end users.
- Each plan is opinionated — one recommended approach, alternatives noted only when explicitly rejected with a reason.
- "Out of scope" sections are load-bearing — they exist to stop scope creep, not as filler.
- When a plan is implemented, update its Status here (and in the plan file's own header if it has one) rather than deleting the file — they're a historical record of decisions, same as this project's `docs/` mirrors the checkpd-admin project's convention.
