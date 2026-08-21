# PLAN-007: Employee Self-Service Stats ("ประวัติของฉัน")

## Overview

The employee LIFF page ([page.tsx](../src/app/page.tsx)) only ever shows *today's* status. An employee has no way to see their own attendance history or monthly totals — they'd have to ask an admin. The user asked for this directly: *"ถ้าผู้ใช้อยากดู stat การทำงานของตัวเอง performance ในการทำงาน"*.

**Reason for change:** self-service reduces admin load (no more "how many hours did I work this month?" questions) and gives staff visibility/accountability over their own record.

## Related plans

- [[PLAN-008]] — the LINE-OA text-keyword reply feature wants the *same* monthly summary numbers delivered as a chat message instead of a UI panel. This plan introduces the shared aggregation helper both features call, so the numbers are guaranteed to match between the two surfaces.
- [[PLAN-005]] — reuses `formatBangkokTime` / Bangkok-timezone conventions from [workSchedule.ts](../src/lib/workSchedule.ts) / [workDate.ts](../src/lib/workDate.ts)

## Scope

**In scope:**
- New shared helper `getEmployeeMonthSummary(supabase, employeeId, month)` → `{ daysPresent, totalMinutes, missingClockOutDays, onTimeDays }` (`onTimeDays` counts days where `clock_in_at` was at/before the 8:30 standard start — simple derived stat, no new schema)
- In-page toggle on the LIFF app (not a new route — see rationale below): a "ประวัติของฉัน" button switches the card from "today" view to a "this month" summary + a scrollable list of this month's daily rows (date, in, out, hours)
- Month back/forward arrows within that panel (reuses the same `getEmployeeMonthSummary` call with a different month)
- "กลับไปหน้าวันนี้" button to return to the normal clock-in/out view

**Out of scope:**
- A separate route/page for this (e.g. `/history`) — **rejected**: LIFF's SDK warns against calling `liff.init()` more than once per session (observed in dev logs already), and a full route navigation risks re-triggering the LIFF init/login flow unnecessarily. An in-page view toggle (client state, no navigation) sidesteps that entirely and is simpler.
- Comparing performance across employees (that's the admin's `/admin/stats`, not something an employee should see about coworkers)
- Any kind of ranking/gamification — "performance" here means *my own* attendance facts (days present, hours, punctuality), not a score or leaderboard

## Preflight checks

```bash
# confirm no self-stats endpoint exists yet
grep -rn "my-stats\|getEmployeeMonthSummary" src/

# confirm the employee session helper's shape (employeeId field name) before reusing it
cat src/lib/requireSession.ts
```

## Data model / Fetch strategy

No schema change.

```ts
// src/lib/attendanceStats.ts (new, shared by this plan and PLAN-008)
export async function getEmployeeMonthSummary(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string,
  month: string // YYYY-MM
) {
  const { data: rows } = await supabase
    .from("attendance")
    .select("work_date, clock_in_at, clock_out_at, total_minutes")
    .eq("employee_id", employeeId)
    .gte("work_date", `${month}-01`)
    .lte("work_date", lastDayOfMonth(month)) // from PLAN-006's workDate.ts addition
    .order("work_date", { ascending: true });

  // reduce into { daysPresent, totalMinutes, missingClockOutDays, onTimeDays, rows }
}
```

New endpoint: `GET /api/attendance/my-stats?month=YYYY-MM` — employee-session gated (same `getSession(req)` pattern as [check-location/route.ts](../src/app/api/attendance/check-location/route.ts)), calls the helper for `session.employeeId`, returns the summary + the raw `rows` for the list view.

## UI structure

```text
┌─────────────────────────────┐
│ [🟢] ChulaPD Attendance       │
│                               │
│ [< ] สิงหาคม 2569 [ >]  [ปิด] │
│                               │
│ มาทำงาน 18 วัน                │
│ รวม 142:30 ชม.                │
│ ลืม Clock out 1 วัน           │
│ ตรงเวลา 15 วัน                │
│ ────────────────────────     │
│ 01/08  08:27 – 16:35  8:08   │
│ 02/08  08:31 – 16:30  7:59   │
│ 03/08  -     -        -      │
│ ...                           │
└─────────────────────────────┘
```

Toggled in from the normal view via a small "ประวัติของฉัน →" link/button placed under the existing status card in [page.tsx](../src/app/page.tsx).

## Files to create / modify

| File | Change |
|---|---|
| `src/lib/attendanceStats.ts` *(new)* | `getEmployeeMonthSummary()` per above; add `lastDayOfMonth` import from `workDate.ts` (added in [[PLAN-006]] — land that plan first, or duplicate the tiny helper temporarily if implementation order flips) |
| `src/app/api/attendance/my-stats/route.ts` *(new)* | GET handler per Data model section |
| [src/app/page.tsx](../src/app/page.tsx) | Add `view: "today" \| "history"` state; "ประวัติของฉัน" toggle button; history panel component (can stay inline in this file or split into `src/components/employee/history-panel.tsx` if it gets long — Codex's call) |

## Edge cases & rules

1. Month navigation shouldn't allow going further back than the employee's `created_at` month (no point showing empty months before they existed) — clamp the back-arrow, don't hard-disable-without-feedback.
2. Month navigation shouldn't go past the current month (no future data to show) — clamp the forward-arrow at the current Bangkok month.
3. A day with `clock_in_at` set but `clock_out_at` null (still in progress, or forgot) shows `-` for the out-time and hours in the list, not `0:00`.
4. "ตรงเวลา" (on-time) comparison must use the same Bangkok-timezone extraction pattern as [workSchedule.ts](../src/lib/workSchedule.ts)'s `getBangkokTimeParts`, not a naive `Date` comparison that could be off by the server's local timezone.
5. Empty month (employee had zero attendance) shows a plain "ไม่มีข้อมูลเดือนนี้" state, not a broken/zero-division summary.

## Verification checklist

- [ ] "ประวัติของฉัน" toggles the panel without a full page reload or re-running `liff.init()`
- [ ] Current month shows correct totals (spot-check against `/admin`'s numbers for the same employee/days)
- [ ] Month back/forward arrows work and clamp at the employee's join month / current month
- [ ] A day with no clock-out shows `-`, not `0:00` or a crash
- [ ] "กลับไปหน้าวันนี้" returns to the normal clock-in/out card, state intact (doesn't re-trigger geolocation/LIFF init)
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Cross-employee comparison/leaderboard (explicitly rejected — see Scope)
- Exporting the employee's own history as a file (admin-side export already covers certification needs — see [[PLAN-006]])

## Rollback plan

Confined to: `src/lib/attendanceStats.ts`, `src/app/api/attendance/my-stats/route.ts`, and the additions to [src/app/page.tsx](../src/app/page.tsx). No schema change — revert/delete to fully undo.
