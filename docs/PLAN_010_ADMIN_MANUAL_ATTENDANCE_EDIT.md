# PLAN-010: Admin Manual Edit of Clock In/Out Times

## Overview

There is currently no way to fix an attendance row once it's wrong — an employee who forgot to clock in/out entirely has no row (or a half-filled one) for that day, and nobody, including an admin, can correct it. The user asked for this directly on the main `/admin` (daily attendance) page: *"สร้างปุ่มลับให้สามารถ edit เวลาได้กรณีลืมกด"*.

**Reason for change:** "forgot to clock in/out" is an explicitly anticipated case in the original brief ([clock_in.md](../clock_in.md) §6) — the brief's answer was a formal employee-submitted-request + admin-approval workflow over `attendance_adjustments`. That table still has zero UI/API touching it (unchanged since [[PLAN-005]] deferred it). This plan is **not** that workflow — it's a narrower, faster tool: a direct admin edit, for when an admin already knows the fix and just wants to key it in, without a request/approval round-trip. The word "ลับ" (secret/tucked-away) in the request signals intent: a low-visibility control an admin can reach, not something that invites casual misuse or looks like a normal end-user feature.

## Related plans

- [[PLAN-002]] — this plan's edit button lives on the same `/admin` table PLAN-002 added the date picker to; after a successful edit, reuse `router.refresh()` (the same mechanism `AutoRefresh` already uses) to reflect the change immediately
- [[PLAN-005]] — explicitly the narrower alternative to the `attendance_adjustments` workflow that plan deferred; this plan finally gives the **first real use** of the previously schema-only `audit_logs` table, recording every admin edit for accountability, since a silent direct-edit tool without an audit trail would be a real risk for something used as a work-hour certification record ([[PLAN-006]])

## Scope

**In scope:**
- Small, low-visibility icon-only button (pencil icon, ghost variant, no label text) at the end of each row in `/admin`'s attendance table — deliberately not a prominent labeled "Edit" column, per the "ปุ่มลับ" framing
- Clicking it opens a Dialog: employee name + date (read-only header), clock-in time input, clock-out time input (both `<input type="time">`, prefilled from the row's current values in Bangkok time, blank if unset), Save/Cancel
- Either time field can be **cleared** (submitted empty) to null out that column — covers "undo an accidental clock-out" as well as "fill in a forgotten clock-in"
- On save: `total_minutes` is recomputed server-side from the new times (or set to `null` if either is missing)
- Every successful edit writes a row to `audit_logs` (`action: "admin_edit_attendance"`, `entity_type: "attendance"`, `entity_id`, `user_id` = the editing admin's id from the admin session, `old_value`/`new_value` = the before/after `{clock_in_at, clock_out_at, total_minutes}` as jsonb) — this is the first real writer of that table
- Available regardless of which date is being viewed (works with PLAN-002's date picker, not just "today")

**Out of scope:**
- The full `attendance_adjustments` request/approve/reject workflow — still deferred (see [[PLAN-005]]'s original rationale, unchanged: this is a *direct* admin edit, not an employee-initiated request)
- Editing lat/lng/accuracy fields, `status`, or creating a **brand-new** attendance row for a day with none at all — this plan only edits the two time columns on an **existing** row. (A day with zero attendance for an employee has no row to click "edit" on in the first place; adding a "create a row for a day with none" flow is a natural follow-up but is a different UI shape — a picker for which employee/day, not a row-level button — better as its own small plan if needed)
- Surfacing the audit log anywhere in the UI (e.g. an "edit history" view) — this plan only *writes* to `audit_logs`; reading/displaying it is a future plan once there's enough data to make a viewer worthwhile
- Any confirmation/notification back to the employee that their record was changed — silent from the employee's side for now

## Preflight checks

```bash
# confirm audit_logs has never been written to
grep -rn "audit_logs" src/   # expect: no match anywhere yet

# confirm the exact attendance columns available to edit
# (clock_in_at, clock_out_at, total_minutes, work_date — from existing admin/page.tsx query)
grep -n "clock_in_at, clock_out_at" src/app/admin/page.tsx

# confirm admin session shape (need adminUserId for audit_logs.user_id)
cat src/lib/adminSession.ts
```

## Data model / Fetch strategy

No schema change — `audit_logs` already exists (`id, user_id, action, entity_type, entity_id, old_value, new_value, created_at`), just unused until now.

```ts
// PATCH /api/admin/attendance/[id]
// body: { clockInTime: "HH:mm" | null, clockOutTime: "HH:mm" | null }

const { data: existing } = await supabase
  .from("attendance")
  .select("id, work_date, employee_id, clock_in_at, clock_out_at, total_minutes")
  .eq("id", id)
  .single();

const clockInAt = clockInTime ? `${existing.work_date}T${clockInTime}:00+07:00` : null;
const clockOutAt = clockOutTime ? `${existing.work_date}T${clockOutTime}:00+07:00` : null;
const totalMinutes =
  clockInAt && clockOutAt
    ? Math.round((new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 60000)
    : null;

const { data: updated } = await supabase
  .from("attendance")
  .update({ clock_in_at: clockInAt, clock_out_at: clockOutAt, total_minutes: totalMinutes, updated_at: new Date().toISOString() })
  .eq("id", id)
  .select("id, clock_in_at, clock_out_at, total_minutes")
  .single();

await supabase.from("audit_logs").insert({
  user_id: session.adminUserId,
  action: "admin_edit_attendance",
  entity_type: "attendance",
  entity_id: id,
  old_value: { clock_in_at: existing.clock_in_at, clock_out_at: existing.clock_out_at, total_minutes: existing.total_minutes },
  new_value: { clock_in_at: clockInAt, clock_out_at: clockOutAt, total_minutes: totalMinutes },
});
```

## UI structure

```text
┌ row in /admin's table ──────────────────────────────┐
│ เจ้าหน้าที่ A   08:27   16:35   8:08   ปกติ      [✏]  │  ← small, low-emphasis icon button
└──────────────────────────────────────────────────────┘

click [✏] →

┌───────────────────────────────┐
│ แก้ไขเวลา — เจ้าหน้าที่ A       │
│ วันที่ 19 สิงหาคม 2569           │
│                                 │
│ เวลาเข้า  [08:27]               │
│ เวลาออก  [16:35]               │
│ (ลบเวลาในช่องเพื่อล้างค่า)        │
│                                 │
│         [ยกเลิก]   [บันทึก]     │
└───────────────────────────────┘
```

## Files to create / modify

| File | Change |
|---|---|
| `src/app/api/admin/attendance/[id]/route.ts` *(new)* | PATCH handler per Data model section above |
| `src/components/admin/edit-attendance-button.tsx` *(new, client)* | Icon button + `Dialog` with the two time inputs; on save, PATCHes the route then calls `router.refresh()` and closes |
| [src/app/admin/page.tsx](../src/app/admin/page.tsx) | Add a trailing (unlabeled or minimally-labeled) table column rendering `<EditAttendanceButton attendanceId={row.id} workDate={workDate} employeeName={displayName} clockInAt={row.clock_in_at} clockOutAt={row.clock_out_at} />` per row |

## Edge cases & rules

1. Setting clock-out earlier than clock-in (a plausible fat-finger while manually typing times) → reject client-side before submitting *and* re-validate server-side (never trust client validation alone) with a clear Thai error, don't silently store a negative `total_minutes`.
2. Clearing **both** fields is allowed (effectively "this day never happened") — don't special-case it; it's just `clock_in_at: null, clock_out_at: null, total_minutes: null`, matching what a genuinely-absent day already looks like in the ledger/export.
3. The audit log's `old_value`/`new_value` must capture the state **as it actually was in the DB**, not what the UI happened to have loaded (fetch `existing` fresh in the route right before updating, don't trust a client-supplied "before" value) — guards against a stale dialog silently producing a wrong audit trail if two admins edit the same row close together.
4. This is a direct write to `attendance`, not `attendance_adjustments` — no approval step, takes effect immediately. Because of that, `audit_logs` is not optional here (see Scope) — skipping it would leave zero accountability trail for an already low-visibility, no-confirmation-to-employee feature.
5. Time inputs are edited as plain wall-clock `HH:mm` in Bangkok time and combined with the row's own `work_date` server-side (see Data model) — never let the browser's local timezone leak into the conversion, same principle already established in [workSchedule.ts](../src/lib/workSchedule.ts)/[workDate.ts](../src/lib/workDate.ts).

## Verification checklist

- [ ] Edit button is visually unobtrusive (icon-only, doesn't read as a primary action) but discoverable/clickable
- [ ] Editing a row's clock-in/out updates `/admin`'s table immediately after save (via `router.refresh()`) without a manual reload
- [ ] Recomputed `total_minutes` matches the new times
- [ ] Clearing a field nulls it out correctly (verify in DB, and that `/admin/stats` and `/admin/export` reflect it correctly afterward — null shouldn't render as `0:00`/`NaN` anywhere downstream)
- [ ] Setting clock-out before clock-in is rejected with a clear message, no row mutation happens
- [ ] `audit_logs` gets exactly one new row per successful edit, with correct `old_value`/`new_value`/`user_id`
- [ ] Editing works on a non-today date (via PLAN-002's date picker), not just today
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Full `attendance_adjustments` request/approve workflow (still deferred, per [[PLAN-005]])
- Creating a brand-new attendance row for a day with none at all (different UI shape — needs an employee+day picker, not a row button)
- An "edit history" viewer over `audit_logs`
- Notifying the employee their record was changed

## Rollback plan

Confined to: `src/app/api/admin/attendance/[id]/route.ts`, `src/components/admin/edit-attendance-button.tsx`, and the column addition in [src/app/admin/page.tsx](../src/app/admin/page.tsx). No schema change (`audit_logs` already existed, unused). Revert those three to fully undo; any rows already written to `audit_logs` are historical record and don't need cleanup.
