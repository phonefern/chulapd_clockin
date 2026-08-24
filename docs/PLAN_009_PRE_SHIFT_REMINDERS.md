# PLAN-009: Pre-shift Reminders (10 min before 08:30 / 16:30, all active employees)

## Overview

Two reminder cron jobs already exist ([[late-clock-in]] / [[forgot-clock-out]], wired via [vercel.json](../vercel.json)) — both are **conditional**, targeting only employees who match a problem state (haven't clocked in yet by 08:45; clocked in but not out by 17:00). The user now wants an **unconditional, proactive** heads-up sent to (almost) everyone shortly before each boundary: *"routine เตือนทุกวันก่อน 8:30 และ 16:30 ก่อน 10 นาทีให้กับทุกคน... เพิ่มขึ้นมาจากคนที่ลืมและสาย"*.

**Reason for change:** a "you're already late" message is reactive; a "heads up, 10 minutes left" message is preventive and reaches people before they've actually missed anything.

**Critical constraint discovered while planning:** Vercel's Cron Jobs on the **Hobby plan have only per-hour scheduling precision (±59 minutes)** — a job configured for `20 1 * * 1-5` (08:20 Bangkok) can actually fire anywhere between 08:00 and 08:59, which defeats the entire point of a "10 minutes before" reminder (it could fire 25 minutes early or, worse, *after* 08:30 has already passed). This is confirmed current Vercel documentation (Hobby: "Once per day" minimum interval + "Per-hour (±59 min)" scheduling precision; Pro/Enterprise: per-minute). The existing two cron jobs tolerate this fine (they're windowed status checks, not precise countdowns) — this plan's two new jobs do not.

**Decision (user-confirmed):** use **GitHub Actions scheduled workflows** to trigger these two new reminders instead of `vercel.json` cron. GitHub Actions' `schedule` trigger is minute-precise (with the platform's own best-effort, typically far tighter than Vercel Hobby's ±59min) and is free for a repo like this one. The two existing Vercel Cron jobs are left untouched — no need to migrate what already works.

## Related plans

- Builds on the existing (pre-`docs/` series) cron infrastructure: [cronAuth.ts](../src/lib/cronAuth.ts), [lineMessaging.ts](../src/lib/lineMessaging.ts), the `late-clock-in`/`forgot-clock-out` routes under `src/app/api/cron/`.
- [[PLAN-008]] reuses `getEmployeeTodayStatus`-style logic; this plan's "who's already clocked in/out" filtering follows the same pattern already proven in `late-clock-in`/`forgot-clock-out`.

## Scope

**In scope:**
- One new parameterized route, `GET /api/cron/pre-shift-reminder?phase=start|end`, guarded by the same `isAuthorizedCronRequest` check as the existing cron routes
- `phase=start` (fires ~08:20): message to all **active** employees with a `line_user_id` who have **not yet clocked in today** — "อีก 10 นาทีจะถึงเวลาทำงาน (08:30 น.) นะครับ"
- `phase=end` (fires ~16:20): message to all employees **currently clocked in but not yet out today** — "อีก 10 นาทีจะถึงเวลาเลิกงาน (16:30 น.) นะครับ อย่าลืม Clock out ก่อนกลับ" (same audience-shape as `forgot-clock-out`, just earlier + softer wording — a heads-up, not a "you forgot" scold)
- New GitHub Actions workflow `.github/workflows/pre-shift-reminders.yml`: two `schedule` triggers (`20 1 * * 1-5` = 08:20 Bangkok, `20 9 * * 1-5` = 16:20 Bangkok), each `curl`s the route with the matching `phase` and the shared `CRON_SECRET` (as a **GitHub Actions repo secret**, same value as Vercel's `CRON_SECRET` env var — one secret, two trigger paths)
- `workflow_dispatch:` trigger included for manual testing without waiting for the schedule

**Out of scope:**
- Migrating the existing `late-clock-in`/`forgot-clock-out` Vercel Cron jobs to GitHub Actions — they work fine as windowed checks; only add this complexity if their imprecision becomes an actual reported problem
- Making the 10-minute lead time configurable — hardcode `08:20`/`16:20` (matches the fixed 08:30/16:30 schedule already hardcoded in [workSchedule.ts](../src/lib/workSchedule.ts))
- Skipping days off / public holidays — same limitation as the existing two cron jobs (Mon–Fri only, no holiday calendar yet)

## Preflight checks

```bash
# confirm no .github/workflows directory exists yet
ls -la .github/workflows 2>/dev/null || echo "none yet"

# confirm the exact audience-filter pattern to reuse
cat src/app/api/cron/late-clock-in/route.ts
cat src/app/api/cron/forgot-clock-out/route.ts

# confirm CRON_SECRET's current value (needed to add as a GitHub secret too — same value, two places)
grep CRON_SECRET .env.local
```

## Data model / Fetch strategy

No schema change. `phase=start` reuses `late-clock-in`'s query shape (all active employees minus those with `clock_in_at` set today); `phase=end` reuses `forgot-clock-out`'s query shape (today's attendance rows with `clock_in_at` set and `clock_out_at` null) — same Supabase calls, just triggered 25–40 minutes earlier and with different message text. Recommend literally sharing the query/loop code between this route and the two existing ones via a small extracted helper rather than copy-pasting a third time:

```ts
// src/lib/attendanceCronTargets.ts (new)
export async function getNotYetClockedInToday(supabase): Promise<EmployeeTarget[]> { ... } // used by late-clock-in AND pre-shift-reminder(phase=start)
export async function getClockedInNotOutToday(supabase): Promise<EmployeeTarget[]> { ... } // used by forgot-clock-out AND pre-shift-reminder(phase=end)
```

This means touching `late-clock-in/route.ts` and `forgot-clock-out/route.ts` to extract their existing query logic into this shared module (behavior-preserving refactor), not just adding new code.

## UI structure

Not applicable — LINE push messages only, no UI. Example:

```text
[08:20] อีก 10 นาทีจะถึงเวลาทำงาน (08:30 น.) นะครับ
        กดลิงก์นี้เพื่อ Clock in
        https://liff.line.me/2011169166-7Jd6jYU1

[16:20] อีก 10 นาทีจะถึงเวลาเลิกงาน (16:30 น.) นะครับ
        อย่าลืม Clock out ก่อนกลับ
        https://liff.line.me/2011169166-7Jd6jYU1
```

## Files to create / modify

| File | Change |
|---|---|
| `src/lib/attendanceCronTargets.ts` *(new)* | Extracted `getNotYetClockedInToday()` / `getClockedInNotOutToday()` helpers |
| [src/app/api/cron/late-clock-in/route.ts](../src/app/api/cron/late-clock-in/route.ts) | Refactor to call `getNotYetClockedInToday()` instead of its inline query (behavior unchanged) |
| [src/app/api/cron/forgot-clock-out/route.ts](../src/app/api/cron/forgot-clock-out/route.ts) | Refactor to call `getClockedInNotOutToday()` instead of its inline query (behavior unchanged) |
| `src/app/api/cron/pre-shift-reminder/route.ts` *(new)* | GET handler: `isAuthorizedCronRequest` guard, reads `?phase=`, calls the matching helper, pushes the matching message text |
| `.github/workflows/pre-shift-reminders.yml` *(new)* | Two `schedule` cron triggers + `workflow_dispatch`; branches on `github.event.schedule` to call the route with the right `phase` |

## Edge cases & rules

1. `?phase=` missing or not `start`/`end` → `400`, don't guess.
2. `phase=start` must exclude employees who clocked in **early** (before 08:20) — same "already satisfied, don't nag" principle as `late-clock-in`.
3. `phase=end` must exclude employees with **no attendance row at all today** (absent/on leave — a "10 min to end of shift" message makes no sense for someone who never started) as well as those already clocked out.
4. GitHub Actions `schedule` triggers can be delayed under platform load (documented GitHub behavior, same caveat as any hosted scheduler) — this is a best-effort improvement over Vercel Hobby's ±59min, not a hard real-time guarantee. Don't promise the reminder fires at exactly :20.
5. The GitHub Actions workflow's `curl` call must fail the job (non-zero exit) on a non-2xx response (`curl -f`) so a broken deploy or wrong secret shows up as a failed Action run in the GitHub UI, not a silent no-op.
6. `CRON_SECRET` must be added as a **GitHub Actions repository secret** (Settings → Secrets and variables → Actions), matching the value already in Vercel's env vars — these are two independent places holding the same secret; rotating it later means updating both.

## Verification checklist

- [ ] `workflow_dispatch` manual run (both phases, via the Actions tab "Run workflow" button) successfully pushes messages to the right audience
- [ ] `phase=start` skips an employee who already clocked in
- [ ] `phase=end` skips an employee who never clocked in today, and skips one who already clocked out
- [ ] `late-clock-in` and `forgot-clock-out` still behave identically after the extraction refactor (re-run their existing verification steps from the pre-`docs/` implementation)
- [ ] Scheduled (not manual) runs fire close to 08:20 / 16:20 Bangkok on a real weekday — check the Actions run history timestamps
- [ ] Wrong/missing `CRON_SECRET` on the GitHub side makes the Action run fail loudly (not silently succeed with 0 sent)
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Migrating `late-clock-in`/`forgot-clock-out` off Vercel Cron onto GitHub Actions too, for consistency — only if Hobby's imprecision becomes an actual problem for those
- Holiday calendar (currently Mon–Fri only, no public-holiday awareness anywhere in the system)
- Configurable lead-time / work-schedule (still hardcoded constants)

## Rollback plan

Confined to: `src/lib/attendanceCronTargets.ts`, the new `pre-shift-reminder` route, `.github/workflows/pre-shift-reminders.yml`, and the refactor of the two existing cron routes (which is behavior-preserving and independently revertible). No schema change. Deleting the workflow file alone fully stops the new reminders without touching anything else.
