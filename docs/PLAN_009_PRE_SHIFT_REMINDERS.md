# PLAN-009: Pre-shift Reminders (10 min before 08:30 / 16:30, all active employees)

## Overview

Two reminder cron jobs already exist ([[late-clock-in]] / [[forgot-clock-out]], wired via [vercel.json](../vercel.json)) — both are **conditional**, targeting only employees who match a problem state (haven't clocked in yet by 08:45; clocked in but not out by 17:00). The user now wants an **unconditional, proactive** heads-up sent to (almost) everyone shortly before each boundary: *"routine เตือนทุกวันก่อน 8:30 และ 16:30 ก่อน 10 นาทีให้กับทุกคน... เพิ่มขึ้นมาจากคนที่ลืมและสาย"*.

**Reason for change:** a "you're already late" message is reactive; a "heads up, 10 minutes left" message is preventive and reaches people before they've actually missed anything.

**Critical constraint discovered while planning:** Vercel's Cron Jobs on the **Hobby plan have only per-hour scheduling precision (±59 minutes)** — a job configured for `20 1 * * 1-5` (08:20 Bangkok) can actually fire anywhere between 08:00 and 08:59, which defeats the entire point of a "10 minutes before" reminder (it could fire 25 minutes early or, worse, *after* 08:30 has already passed). This is confirmed current Vercel documentation (Hobby: "Once per day" minimum interval + "Per-hour (±59 min)" scheduling precision; Pro/Enterprise: per-minute). The existing two cron jobs tolerate this fine (they're windowed status checks, not precise countdowns) — this plan's two new jobs do not.

**Decision (revised, user-confirmed):** trigger these two new reminders from **GCP Cloud Scheduler** instead of `vercel.json` cron — not GitHub Actions (an earlier draft of this plan chose GitHub Actions; superseded once the user pointed out they already run production cron for the related `checkpd` app on GCP Cloud Scheduler and asked to use the same). Cloud Scheduler is a dedicated managed cron product with proper minute-level precision and native IANA timezone support (`--time-zone=Asia/Bangkok`, no UTC math needed) — strictly more reliable than GitHub Actions' best-effort `schedule` trigger, which is free but known to run late under platform load. The user's `checkpd` GCP project already has Cloud Scheduler jobs running in `asia-southeast1` with `Asia/Bangkok` timezone (`checkpd-risk-summary`, `checkpd-migrate-demographic-v2-daily`, etc.) — this plan's two jobs follow that exact convention, just prefixed `chulapd-clockin-` to distinguish them from the unrelated checkpd-app jobs sharing the same GCP project. The two existing Vercel Cron jobs are left untouched — no need to migrate what already works.

**Division of labor:** the Cloud Scheduler jobs themselves are infrastructure config (created via `gcloud scheduler jobs create http ...`), not application code — same category as the Supabase schema grants and the LINE Rich Menu setup done directly earlier in this project, outside the Codex/PLAN code-review loop. Only the new Next.js route + the refactor below go through Codex.

## Related plans

- Builds on the existing (pre-`docs/` series) cron infrastructure: [cronAuth.ts](../src/lib/cronAuth.ts), [lineMessaging.ts](../src/lib/lineMessaging.ts), the `late-clock-in`/`forgot-clock-out` routes under `src/app/api/cron/`.
- [[PLAN-008]] reuses `getEmployeeTodayStatus`-style logic; this plan's "who's already clocked in/out" filtering follows the same pattern already proven in `late-clock-in`/`forgot-clock-out`.

## Scope

**In scope:**
- One new parameterized route, `GET /api/cron/pre-shift-reminder?phase=start|end`, guarded by the same `isAuthorizedCronRequest` check as the existing cron routes
- `phase=start` (fires ~08:20): message to all **active** employees with a `line_user_id` who have **not yet clocked in today** — "อีก 10 นาทีจะถึงเวลาทำงาน (08:30 น.) นะครับ"
- `phase=end` (fires ~16:20): message to all employees **currently clocked in but not yet out today** — "อีก 10 นาทีจะถึงเวลาเลิกงาน (16:30 น.) นะครับ อย่าลืม Clock out ก่อนกลับ" (same audience-shape as `forgot-clock-out`, just earlier + softer wording — a heads-up, not a "you forgot" scold)
- Two GCP Cloud Scheduler HTTP jobs (`chulapd-clockin-pre-shift-start`, `chulapd-clockin-pre-shift-end`) in the `checkpd` project, `asia-southeast1`, `--time-zone=Asia/Bangkok`, schedules `20 8 * * 1-5` and `20 16 * * 1-5` respectively — each calls the route with the matching `phase` and a static `Authorization: Bearer $CRON_SECRET` header (same secret already used by Vercel's env var; Cloud Scheduler stores it as a static header value on the job, no separate secret store needed for this simple case)

**Out of scope:**
- Migrating the existing `late-clock-in`/`forgot-clock-out` Vercel Cron jobs to Cloud Scheduler — they work fine as windowed checks; only add this complexity if their imprecision becomes an actual reported problem
- Making the 10-minute lead time configurable — hardcode `08:20`/`16:20` (matches the fixed 08:30/16:30 schedule already hardcoded in [workSchedule.ts](../src/lib/workSchedule.ts))
- Skipping days off / public holidays — same limitation as the existing two cron jobs (Mon–Fri only, no holiday calendar yet)

## Preflight checks

```bash
# confirm the exact audience-filter pattern to reuse
cat src/app/api/cron/late-clock-in/route.ts
cat src/app/api/cron/forgot-clock-out/route.ts

# confirm CRON_SECRET's current value (used as the static Authorization header on the Cloud Scheduler jobs)
grep CRON_SECRET .env.local

# confirm gcloud is authenticated against the right project before creating jobs
gcloud config list
```

Cloud Scheduler job creation (infra step, run once the route below is deployed to production — not part of the Codex code change):

```bash
gcloud scheduler jobs create http chulapd-clockin-pre-shift-start \
  --location=asia-southeast1 \
  --schedule="20 8 * * 1-5" \
  --time-zone="Asia/Bangkok" \
  --uri="https://chulapd-clockin.vercel.app/api/cron/pre-shift-reminder?phase=start" \
  --http-method=GET \
  --headers="Authorization=Bearer <CRON_SECRET_VALUE>"

gcloud scheduler jobs create http chulapd-clockin-pre-shift-end \
  --location=asia-southeast1 \
  --schedule="20 16 * * 1-5" \
  --time-zone="Asia/Bangkok" \
  --uri="https://chulapd-clockin.vercel.app/api/cron/pre-shift-reminder?phase=end" \
  --http-method=GET \
  --headers="Authorization=Bearer <CRON_SECRET_VALUE>"
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

No workflow/CI file is added for this — the two Cloud Scheduler jobs are created directly via `gcloud` (see Preflight checks above), same infra-not-code treatment as the Supabase grants and LINE Rich Menu setup done earlier.

## Edge cases & rules

1. `?phase=` missing or not `start`/`end` → `400`, don't guess.
2. `phase=start` must exclude employees who clocked in **early** (before 08:20) — same "already satisfied, don't nag" principle as `late-clock-in`.
3. `phase=end` must exclude employees with **no attendance row at all today** (absent/on leave — a "10 min to end of shift" message makes no sense for someone who never started) as well as those already clocked out.
4. Cloud Scheduler retries failed HTTP calls by default (configurable retry policy) — a transient 5xx from the route (e.g. a cold-start hiccup) will be retried automatically rather than silently skipping that day's reminder.
5. `CRON_SECRET`'s value is stored as a **static header on each Cloud Scheduler job** (`--headers="Authorization=Bearer ..."`), not in a separate secret manager for this simple case. Rotating `CRON_SECRET` later means updating three places: Vercel's env var, and both `gcloud scheduler jobs update http ...` calls for these two jobs (plus Vercel's own two cron routes read the same var, so they stay in sync automatically — only the Cloud Scheduler jobs' static headers need a manual update on rotation).
6. Job names are prefixed `chulapd-clockin-` specifically so they're visually distinguishable from the pre-existing, unrelated `checkpd-*` jobs living in the same GCP project/region — don't let the two apps' scheduled jobs become ambiguous in `gcloud scheduler jobs list`.

## Verification checklist

- [ ] `gcloud scheduler jobs run chulapd-clockin-pre-shift-start --location=asia-southeast1` (manual trigger) successfully pushes messages to the right audience
- [ ] Same manual trigger for `chulapd-clockin-pre-shift-end`
- [ ] `phase=start` skips an employee who already clocked in
- [ ] `phase=end` skips an employee who never clocked in today, and skips one who already clocked out
- [ ] `late-clock-in` and `forgot-clock-out` still behave identically after the extraction refactor (re-run their existing verification steps from the pre-`docs/` implementation)
- [ ] Scheduled (not manual) runs fire at 08:20 / 16:20 Bangkok on a real weekday — check `gcloud scheduler jobs describe <name> --location=asia-southeast1` / Cloud Console execution history
- [ ] Wrong/missing `Authorization` header on the Cloud Scheduler job makes the route return 401 and the job show a failed execution in Cloud Console (not a silent 0-sent success)
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Migrating `late-clock-in`/`forgot-clock-out` off Vercel Cron onto Cloud Scheduler too, for consistency — only if Hobby's imprecision becomes an actual problem for those
- Holiday calendar (currently Mon–Fri only, no public-holiday awareness anywhere in the system)
- Configurable lead-time / work-schedule (still hardcoded constants)
- Moving `CRON_SECRET` into GCP Secret Manager instead of a static Cloud Scheduler header, if rotation frequency ever makes the manual three-place update annoying

## Rollback plan

Confined to: `src/lib/attendanceCronTargets.ts`, the new `pre-shift-reminder` route, and the refactor of the two existing cron routes (behavior-preserving, independently revertible) — no schema change. Deleting the two Cloud Scheduler jobs (`gcloud scheduler jobs delete chulapd-clockin-pre-shift-start --location=asia-southeast1` and the `-end` counterpart) fully stops the new reminders without touching any code.
