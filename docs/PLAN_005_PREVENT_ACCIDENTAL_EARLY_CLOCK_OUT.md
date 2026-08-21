# PLAN-005: Prevent Accidental Early Clock-out

## Overview

The employee LIFF page ([page.tsx](../src/app/page.tsx)) fires `handleClockOut()` immediately on a single tap of the "Clock out" button — there is no confirmation step, and no awareness of the standard work schedule (8:30–16:30, Mon–Fri, per [clock_in.md](../clock_in.md) §1). A mis-tap (fat-finger, or tapping "Clock out" thinking it says "Clock in" right after clocking in) silently ends the person's workday in the database, hours before their actual shift ends.

**Reason for change:** user-reported directly — *"แก้ปัญหาผู้ใช้กด clock in และเผลอกด clock out ในวันนั้นครับก่อนที่ยังไม่ถึงเวลาเลิกงาน"*.

## Related plans

None yet. This plan is self-contained to the employee-facing clock-out flow. Seeds a future plan for a full "request time correction" UI over the existing-but-unwired `attendance_adjustments` table (see Out-of-scope below).

## Scope

**In scope:**
1. **Confirmation dialog** before an early clock-out actually submits, when the current Bangkok time is more than `EARLY_CLOCK_OUT_THRESHOLD_MINUTES` (recommend **30**) before the standard end-of-day (16:30) — i.e. clocking out before **16:00**. Shows the actual time and asks for explicit confirmation. A clock-out at/after 16:00 proceeds exactly as today, no dialog (don't add friction to the common case).
2. **Short undo window**: after a clock-out is recorded, show a dismissible "เพิ่งกด Clock out ไป — [ยกเลิก]" affordance for **2 minutes**, calling a new endpoint that reverses it. This covers the case where the admin dialog itself gets mis-tapped through.

**Out of scope:**
- **Full "request time correction" workflow.** The schema already has `attendance.attendance_adjustments` (original design doc [clock_in.md](../clock_in.md) §6–7: employee requests a correction with a reason, admin approves/rejects, audit-logged) but **no UI or API route touches this table anywhere in the current codebase** — it's schema-only. Building that properly (employee request form, admin approve/reject queue, audit trail display) is a substantial feature on its own and deserves its own PLAN. This plan's 2-minute undo is a narrow stopgap for the *immediate* mis-tap case, not a replacement for that workflow.
- Changing the work-hours policy itself (still 8:30–16:30 Mon–Fri, hardcoded as a constant — not admin-configurable yet)
- Any change to the clock-**in** flow (only clock-out is affected)
- Server-side hard block on early clock-out — a confirmed early clock-out (half day, sick leave, etc.) is a legitimate real-world case and must still be possible; this plan only adds friction to the *accidental* path, never a hard denial

## Preflight checks

```bash
# confirm no existing confirmation step
grep -n "handleClockOut" src/app/page.tsx

# confirm attendance_adjustments truly has zero call sites today (validates the out-of-scope claim above)
grep -rn "attendance_adjustments" src/
```

## Data model / Fetch strategy

No schema change for the confirmation dialog (pure client-side gate before the existing `POST /api/attendance/clock-out` call).

The undo endpoint reverses the same row [clock-out route](../src/app/api/attendance/clock-out/route.ts) just wrote:

```ts
// POST /api/attendance/undo-clock-out
// - requires session (same getSession(req) pattern as clock-in/clock-out)
// - loads today's attendance row for session.employeeId
// - guard: clock_out_at is set AND (now - clock_out_at) <= 2 minutes
// - on pass: set clock_out_at, clock_out_lat, clock_out_lng, clock_out_accuracy,
//            total_minutes all back to null; bump updated_at
// - on fail (window expired / nothing to undo): 400 with a clear Thai message
//   pointing them to ask an admin (until PLAN-00X's correction workflow exists)
```

## UI structure

Confirmation dialog (shadcn `AlertDialog`, same component already used in [employees-table.tsx](../src/components/admin/employees-table.tsx)):

```text
┌───────────────────────────────────┐
│  ยืนยันการ Clock out                │
│  ตอนนี้เวลา 14:12 น. ซึ่งเร็วกว่าเวลา  │
│  เลิกงานปกติ (16:30 น.) ยืนยันว่า    │
│  ต้องการ Clock out ตอนนี้จริงหรือไม่? │
│                                     │
│         [ยกเลิก]   [Clock out]     │
└───────────────────────────────────┘
```

Post-clock-out undo affordance (small inline banner under the status card, auto-dismisses after 2 minutes):

```text
┌───────────────────────────────────┐
│ Clock out แล้วเมื่อ 14:13 น.          │
│ กดผิดใช่ไหม? [ยกเลิก Clock out]      │
└───────────────────────────────────┘
```

## Files to create / modify

| File | Change |
|---|---|
| [src/app/page.tsx](../src/app/page.tsx) | `handleClockOut` gains an early-time check before submitting; opens `AlertDialog` if within the threshold, otherwise proceeds as today; add the post-clock-out undo banner + 2-minute countdown/timer |
| `src/app/api/attendance/undo-clock-out/route.ts` *(new)* | POST handler per the Data model section above, mirroring [clock-out/route.ts](../src/app/api/attendance/clock-out/route.ts)'s auth/lookup pattern |
| `src/lib/workSchedule.ts` *(new)* | Small constants module: `WORK_END_HOUR = 16`, `WORK_END_MINUTE = 30`, `EARLY_CLOCK_OUT_THRESHOLD_MINUTES = 30`, plus a pure `isEarlyClockOut(now: Date): boolean` helper — keeps the magic numbers in one place for [[PLAN-003]]'s future late/early analytics to reuse |

## Edge cases & rules

1. Threshold check uses **Asia/Bangkok** wall-clock time regardless of device/server timezone — reuse the same `Intl.DateTimeFormat(..., { timeZone: "Asia/Bangkok" })` approach already used in [workDate.ts](../src/lib/workDate.ts), don't rely on the device's local timezone.
2. If the employee dismisses/cancels the confirmation dialog, no request is sent at all — stay in the "clocked in, not yet out" state untouched.
3. Undo only works for the **same authenticated session** that clocked out (guarded by `session.employeeId` matching the attendance row's `employee_id`, same as the existing clock-in/out routes) — never allow undoing someone else's record even by row id guessing.
4. Undo window is wall-clock from `clock_out_at`, not from page-load — if the employee closes and reopens the LIFF app within the 2 minutes, the banner (and the ability to undo) must still be available on next load, not just held in React state. Compute "show undo banner" from `attendance.clock_out_at` + `now` on every load of `/api/attendance/today`'s response, not from a one-shot client flag.
5. After a successful undo, the page must return to the exact "clocked in, not yet out" state (timer resumes, Clock out button reappears) — reuse the existing `attendance` state shape, just re-set it from the undo response.

## Verification checklist

- [ ] Clock out at e.g. 10:00 → confirmation dialog appears with the correct current time shown
- [ ] Clock out at/after 16:00 → no dialog, behaves exactly as before this plan
- [ ] Confirming the dialog completes the clock-out and shows the undo banner
- [ ] Cancelling the dialog leaves the employee still clocked in
- [ ] Undo within 2 minutes restores the clocked-in state (verify `clock_out_at` is `null` again in the DB)
- [ ] Undo attempted after 2 minutes returns a clear error and does not modify the row
- [ ] Reloading the LIFF page within the 2-minute window still shows the undo banner (not just a fresh "clocked out" state with no undo option)
- [ ] Undo request from a different employee's session against this row is rejected
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Full request/approve/reject correction workflow over `attendance_adjustments` (biggest follow-up — see rationale above)
- Admin-configurable work schedule (currently hardcoded 8:30–16:30 constants)
- Applying a symmetric "too early to clock in" guard (not requested; clock-in has no reported accidental-tap problem)

## Rollback plan

Confined to: [src/app/page.tsx](../src/app/page.tsx), the new `src/app/api/attendance/undo-clock-out/route.ts`, and the new `src/lib/workSchedule.ts`. No schema change (undo only clears columns that already exist and are nullable). Revert/delete those files to fully undo.
