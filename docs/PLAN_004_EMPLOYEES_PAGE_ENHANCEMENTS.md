# PLAN-004: Employees Page — Search, Today's Status, Visual Polish

## Overview

[/admin/employees](../src/app/admin/employees/page.tsx) currently ships the minimum: a plain table (name, official name, employee code, role, status, edit/delete) with no search, no sort, and no visual relationship to the more polished `/admin` attendance page (which has stat cards, gradients, and a purpose-built CSS module — see [admin.module.css](../src/app/admin/admin.module.css)). The user flagged both — *"หน้า admin ยังไม่สวยเท่าไหร่... employees เช่นกันครับ"*.

**Reason for change:** as headcount grows, an unsearchable flat table stops being usable, and the visual gap between the two admin pages reads as unfinished.

## Related plans

- [[PLAN-001]] — nav-link header pattern established there should extend here (logo + "Attendance วันนี้ ←" / "สถิติ →" links)
- [[PLAN-003]] — adds a "สถิติ →" nav link to this page too; land in either order, small merge either way

## Scope

**In scope:**
- Client-side search box (filters by `name`, `display_name`, `employee_code` — the employee list is small, no need for server-side search)
- Sortable columns: name, employee code, role, status (click header to toggle asc/desc)
- New "วันนี้" column: today's attendance status per employee (`ยังไม่ลงเวลา` / `Clocked in HH:mm` / `Clocked out HH:mm`) — quick at-a-glance without switching to `/admin`
- Stat summary row (matching `/admin`'s pattern): total employees, active count, admin-role count
- Wrap the table in a `Card` (already imported for the login page in [PLAN-001](./PLAN_001_BRANDING.md)) instead of the current bare `rounded-xl border` div, for visual consistency with shadcn usage elsewhere

**Out of scope — explicitly rejected for this plan:**
- **Manual employee pre-registration** (creating a row before the person's first LINE login). Rejected because it doesn't cleanly merge: the LINE-login upsert in [api/auth/line/route.ts](../src/app/api/auth/line/route.ts) matches on `onConflict: "line_user_id"`, and a manually-created row would have `line_user_id = null` — Postgres doesn't treat `null` as a conflict match, so the person's real first login would create a **second, duplicate** row instead of filling in the pre-created one. Solving this needs a real "link my account" flow (e.g. admin issues a one-time code, employee enters it in the LIFF app) — worth its own PLAN if pre-registration becomes a real need.
- CSV/Excel export of the employee list
- Employee photo/avatar upload

## Preflight checks

```bash
# confirm today's attendance isn't already joined into the employees fetch
grep -n "attendance" src/app/admin/employees/page.tsx   # expect: no match

# confirm Card is already available (added in PLAN-001 setup, or via `npx shadcn@latest add card` if not)
ls src/components/ui/card.tsx
```

## Data model / Fetch strategy

No schema change. Two queries in the Server Component (page stays a Server Component; interactivity — search/sort — happens client-side over the already-fetched list, same pattern as [employees-table.tsx](../src/components/admin/employees-table.tsx) today):

```ts
const { data: employees } = await supabase
  .from("employees")
  .select("id, employee_code, name, display_name, line_user_id, role, active, created_at")
  .order("created_at", { ascending: true });

const { data: todayRows } = await supabase
  .from("attendance")
  .select("employee_id, clock_in_at, clock_out_at")
  .eq("work_date", todayInBangkok());

// join in-process: Map<employee_id, { clock_in_at, clock_out_at }>
```

Pass both `employees` and the `todayRows` map into `EmployeesTable` as props; search/sort filtering happens over this combined client-side array — no new API routes needed for this plan.

## UI structure

```text
┌──────────────────────────────────────────────┐
│ [🟢] พนักงาน            Attendance วันนี้ ← สถิติ →│
├──────────────────────────────────────────────┤
│ [ทั้งหมด: 12] [ใช้งาน: 11] [แอดมิน: 2]          │
├──────────────────────────────────────────────┤
│ [🔍 ค้นหาชื่อ/รหัสพนักงาน...............]        │
├──────────────────────────────────────────────┤
│ ชื่อ▲ | ชื่อทางการ | รหัส▲ | สิทธิ์▲ | สถานะ▲ | วันนี้ | จัดการ │
│ ...                                            │
└──────────────────────────────────────────────┘
```

## Files to create / modify

| File | Change |
|---|---|
| [src/app/admin/employees/page.tsx](../src/app/admin/employees/page.tsx) | Add the today's-attendance query + join map; wrap table region in `Card`; add stat summary row + nav links |
| [src/components/admin/employees-table.tsx](../src/components/admin/employees-table.tsx) | Add `todayStatusByEmployee` prop; add search `Input` above the table; add sortable header click handlers (local `useState` for `sortKey`/`sortDir`); add "วันนี้" column |

## Edge cases & rules

1. Search is case-insensitive and matches partial strings across `name`, `display_name`, and `employee_code` (null-safe — an employee with no `display_name` or `employee_code` yet must not crash the filter).
2. Sorting by "สถานะ" (active/inactive) treats active-first as the default ascending direction (matches how an admin scanning for "who's disabled" would expect it — most-relevant-first, not alphabetical `true`/`false`).
3. "วันนี้" column for an employee with no attendance row today shows `ยังไม่ลงเวลา` in a neutral/gray badge, not an error or blank cell.
4. Search + sort state should reset to empty/default when the underlying `employees` prop changes (e.g. after an edit/delete refreshes the list) — don't let stale filter state hide a just-edited row.

## Verification checklist

- [ ] Typing in the search box filters visible rows without a network request
- [ ] Clicking each sortable column header toggles asc/desc and re-orders correctly
- [ ] "วันนี้" column matches what `/admin` shows for the same employee on the same day
- [ ] Stat row counts match the actual filtered-out employee count (recompute correctly after an edit/delete)
- [ ] Existing edit/delete flows (including the force-delete-with-history confirmation from the current implementation) still work unchanged
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Manual pre-registration / account-linking flow (see rejection rationale above) — seed for a future PLAN if the clinic wants to onboard employees before their first LINE login
- CSV export

## Rollback plan

Confined to: [src/app/admin/employees/page.tsx](../src/app/admin/employees/page.tsx) and [src/components/admin/employees-table.tsx](../src/components/admin/employees-table.tsx). No schema or API route changes — revert those two files to fully undo.
