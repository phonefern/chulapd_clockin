# PLAN-006: Monthly Attendance Export (CSV) + Print-for-Signature View

## Overview

The original product brief ([clock_in.md](../clock_in.md) §2, §3.3, §11) lists "Export ข้อมูลเป็น Excel หรือ PDF" and "พิมพ์เอกสารเพื่อให้หัวหน้าหรือผู้มีอำนาจลงนามรับรองได้" as core admin requirements — proving staff actually worked, on a monthly cadence, with a document a supervisor can physically sign. Nothing built so far (`/admin`, `/admin/stats`) produces a downloadable or printable artifact — both are on-screen only.

**Reason for change:** user asked directly for a monthly CSV/Excel export "ว่าเรามาทำงานจริงนะ" — this is a certification/compliance artifact, not just a dashboard view.

## Related plans

- [[PLAN-002]] — reuses `resolveWorkDate`/`isValidWorkDate` from [workDate.ts](../src/lib/workDate.ts)
- [[PLAN-003]] — sibling admin page; this plan's page sits alongside `/admin/stats` in the nav, but is deliberately a **separate** page/route rather than a button bolted onto `/admin/stats`, because a calendar-month ledger (this plan) and a rolling 7d/30d/custom trend view (PLAN-003) are different documents for different purposes and shouldn't share one page's state

## Scope

**In scope:**
- New page `/admin/export`: month picker (`<input type="month">`, default = current month), showing a **daily ledger table** — one row per employee per work day in that month (name, date, clock in, clock out, hours, status) — mirroring the exact table shape already shown in [clock_in.md](../clock_in.md)'s §3.3 mockup
- "ดาวน์โหลด CSV" button → `GET /api/admin/export/attendance-csv?month=YYYY-MM`, returns `text/csv` with a UTF-8 BOM (Excel mis-renders Thai text without it) and `Content-Disposition: attachment; filename="attendance_2026-08.csv"`
- "พิมพ์" button → `window.print()` with `@media print` CSS that hides the header/nav/buttons and keeps only the ledger table + a signature line (`ลงชื่อ ................................... วันที่ ...................`) — this satisfies the brief's print-for-signature requirement without needing a PDF library
- Employees with **zero** attendance that month still get listed with all-dash rows (useful for a supervisor to see who never showed up)

**Out of scope:**
- XLSX (real Excel binary) — CSV opens in Excel fine and is far simpler; only revisit if a real `.xlsx` (multiple sheets, styling) is explicitly requested
- Emailing/auto-sending the report — download/print only
- A "months history" browser (this plan is one-month-at-a-time, matching the picker)

## Preflight checks

```bash
# confirm no export endpoint exists yet
grep -rn "text/csv\|Content-Disposition" src/app/api/

# confirm the daily-ledger query shape matches what /admin/page.tsx already proved works
grep -n "employees(name, display_name, employee_code)" src/app/admin/page.tsx
```

## Data model / Fetch strategy

No schema change. Two queries for the whole month (small dataset — bounded by employee count × ~31 days):

```ts
const monthStart = `${month}-01`;                    // YYYY-MM-01
const monthEnd = lastDayOfMonth(month);               // YYYY-MM-DD

const { data: employees } = await supabase
  .from("employees")
  .select("id, employee_code, name, display_name")
  .eq("active", true)
  .order("employee_code", { ascending: true });

const { data: attendanceRows } = await supabase
  .from("attendance")
  .select("employee_id, work_date, clock_in_at, clock_out_at, total_minutes, status")
  .gte("work_date", monthStart)
  .lte("work_date", monthEnd);

// build the ledger: for each employee × each work_date in the month
// (reuse enumerateWorkDates(monthStart, monthEnd) from workDate.ts),
// look up the matching attendanceRows entry or emit a blank/"ไม่มาทำงาน" row
```

`lastDayOfMonth(month: string): string` is a small new pure helper (add to [workDate.ts](../src/lib/workDate.ts) alongside `enumerateWorkDates`/`addWorkDays`).

## UI structure

```text
┌──────────────────────────────────────────────────┐
│ ส่งออกรายงานรับรองการทำงาน                          │
│ เดือน: [สิงหาคม 2569 ▾]     [🖨 พิมพ์]  [⬇ ดาวน์โหลด CSV] │
├──────────────────────────────────────────────────┤
│ ชื่อ         | วันที่      | เข้า   | ออก   | ชม.  | สถานะ │
│ เจ้าหน้าที่ A | 01/08/2569 | 08:27 | 16:35 | 8:08 | ปกติ  │
│ เจ้าหน้าที่ A | 02/08/2569 | -     | -     | -    | ไม่มาทำงาน│
│ ...                                                │
├──────────────────────────────────────────────────┤
│ [print-only, hidden on screen]                     │
│ ลงชื่อ ...................................          │
│ วันที่ ...................................          │
└──────────────────────────────────────────────────┘
```

## Files to create / modify

| File | Change |
|---|---|
| `src/app/admin/export/page.tsx` *(new)* | Server Component: admin-session gate, month param parsing/validation, builds the ledger, renders table + print styles + download link |
| `src/app/api/admin/export/attendance-csv/route.ts` *(new)* | GET handler: admin-session gate (request-based, same pattern as [api/admin/employees/route.ts](../src/app/api/admin/employees/route.ts)), builds the same ledger, serializes to CSV with BOM, sets `Content-Disposition` |
| [src/lib/workDate.ts](../src/lib/workDate.ts) | Add `lastDayOfMonth(month: string): string` |
| `src/app/globals.css` | Add a `@media print` block hiding `.no-print` elements (nav, buttons) |
| [src/app/admin/page.tsx](../src/app/admin/page.tsx) / [stats/page.tsx](../src/app/admin/stats/page.tsx) | Add "ส่งออก →" nav link |

## Edge cases & rules

1. `month` param missing/malformed → default to current Bangkok month, don't error.
2. Future month with zero data → renders an all-employees, all-"ไม่มาทำงาน" ledger, not an empty page — still a valid (if boring) document.
3. CSV must escape commas/quotes/newlines in `name`/`display_name` per standard CSV quoting rules — a display name someone typed with a comma in it must not corrupt the file.
4. `total_minutes` null (still clocked in / never clocked out that day) → CSV shows blank for hours, status column carries the real signal (`ยังไม่ Clock out` / `ไม่มาทำงาน`), don't render `NaN` or `0:00`.
5. Print CSS must keep the table from being cut awkwardly across page breaks where avoidable (`break-inside: avoid` on rows is a reasonable low-effort attempt — not pixel-perfect pagination, just "don't split a row across pages").

## Verification checklist

- [ ] `/admin/export` redirects unauthenticated visitors to `/admin/login`
- [ ] Default view shows the current month's full ledger
- [ ] Switching month via the picker updates the table
- [ ] CSV downloads with correct filename, opens in Excel with Thai text intact (BOM present)
- [ ] CSV row count = employees × days-in-month (including zero-attendance rows)
- [ ] Print preview (`Ctrl+P` / browser print dialog) shows only the ledger + signature line, no nav/buttons
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Real `.xlsx` export
- Emailed monthly reports
- PDF generation via a library (print-to-PDF via the browser covers this for now)

## Rollback plan

Confined to: `src/app/admin/export/`, `src/app/api/admin/export/`, the `lastDayOfMonth` addition to `workDate.ts`, the `@media print` CSS block, and the two nav-link additions. Revert/delete to fully undo — no schema change.
