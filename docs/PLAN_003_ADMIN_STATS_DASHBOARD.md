# PLAN-003: Admin Stats / Visualization Page

## Overview

There is currently no way to see attendance trends — only a single day's table at `/admin` ([PLAN-002](./PLAN_002_ADMIN_LIVE_REFRESH_AND_DATE_FILTER.md)). The user asked for *"หน้าดู visualize, stat แต่ละวัน"* — a page showing day-by-day patterns (headcount present, hours worked) over a selectable range, for spotting trends and supporting the "Export/Print for signature" use case described in the original product brief ([clock_in.md](../clock_in.md) §3.3, §11).

**Reason for change:** an admin reviewing a week/month needs a chart, not 30 separate single-day table loads.

## Related plans

- [[PLAN-002]] — reuses its date-parsing/validation approach and the `todayInBangkok()` helper; land PLAN-002 first since this plan's UI sits alongside it (nav link between `/admin`, `/admin/employees`, `/admin/stats`).

## Scope

**In scope:**
- New route `/admin/stats`, admin-session-gated like the existing admin pages
- Date-range selector: presets **7 วัน / 30 วัน / กำหนดเอง (custom)**, default 7 days ending today
- KPI row: total active employees, average daily headcount present, average work hours/day (over the range)
- Bar chart: employees clocked-in per day (headcount) across the range
- Bar chart: average work hours per day across the range
- A per-employee summary table for the range: name, days present, total hours, missing-clock-out count

**Out of scope:**
- Late/early-leave analytics — depends on the work-hours policy (8:30–16:30) not yet being enforced anywhere in code (currently only recorded as a fact in [clock_in.md](../clock_in.md); no `status` computation exists beyond `'normal'`). Seed a future PLAN once that policy is implemented.
- Export of the stats page itself to PDF/Excel — the original brief's export requirement is about the raw attendance table (already covered informally by `/admin`), not this aggregate view. Add only if explicitly requested.
- Per-employee drill-down detail page — link employee names as plain text for now, not clickable.

## Preflight checks

```bash
# confirm chart tooling isn't already present
grep -n "recharts" package.json   # expect: no match

# see what the shadcn chart add would bring in (don't apply yet — Codex runs this for real)
npx shadcn@latest add chart --dry-run
```

## Data model / Fetch strategy

No schema change. Single ranged query, aggregated server-side before handing to the client chart component (dataset is small — dozens of employees × ≤30 days — no need for a DB-side aggregate RPC the way checkpd's dashboard needed one for 80k+ rows):

```ts
const { data: rows } = await supabase
  .from("attendance")
  .select("work_date, employee_id, clock_in_at, clock_out_at, total_minutes")
  .gte("work_date", rangeStart) // YYYY-MM-DD
  .lte("work_date", rangeEnd)
  .order("work_date", { ascending: true });

// aggregate in-process:
// - byDay: Map<work_date, { present: number; totalMinutes: number }>
// - byEmployee: Map<employee_id, { daysPresent: number; totalMinutes: number; missingClockOut: number }>
```

Employee names for the per-employee table: a second query on `employees` (id, name, display_name, employee_code) filtered to the `employee_id`s seen in `rows`, or just fetch all active employees once and join in-process — either is fine at this scale; prefer the simpler "fetch all active employees" since the employee count is small.

## UI structure

```text
┌──────────────────────────────────────────────────┐
│ สถิติการลงเวลา          [7 วัน][30 วัน][กำหนดเอง]   │
├──────────────────────────────────────────────────┤
│ [เฉลี่ยคนมาทำงาน/วัน] [เฉลี่ยชม.ทำงาน/วัน] [พนักงานทั้งหมด] │
├──────────────────────────────────────────────────┤
│  จำนวนคนลงเวลาต่อวัน                                │
│  ▇▇  ▇▇▇ ▇▇  ▇▇▇▇ ▇▇  ▇  ▇▇▇   (bar chart)          │
├──────────────────────────────────────────────────┤
│  ชั่วโมงทำงานเฉลี่ยต่อวัน                            │
│  ▅▅  ▆▆▆ ▅▅  ▇▇▇▇ ▅▅  ▃  ▆▆▆   (bar chart)          │
├──────────────────────────────────────────────────┤
│  รายพนักงาน                                        │
│  ชื่อ | วันที่มา | ชม.รวม | ลืม Clock out            │
└──────────────────────────────────────────────────┘
```

## Files to create / modify

| File | Change |
|---|---|
| `src/app/admin/stats/page.tsx` *(new)* | Server Component: admin-session gate (same pattern as [admin/page.tsx](../src/app/admin/page.tsx)), parse range from `searchParams`, run the ranged query, aggregate, render KPI cards + pass aggregates to client chart components |
| `src/components/admin/attendance-charts.tsx` *(new, client)* | Two bar charts using the shadcn `chart.tsx` wrapper + `recharts` |
| `src/components/admin/range-picker.tsx` *(new, client)* | 7d / 30d / custom toggle, updates `?from=&to=` search params |
| [src/app/admin/page.tsx](../src/app/admin/page.tsx) | Add a "สถิติ →" nav link next to the existing "พนักงาน →" link |
| [src/app/admin/employees/page.tsx](../src/app/admin/employees/page.tsx) | Same nav link addition for consistency |
| `package.json` | `recharts` + shadcn `chart.tsx` added via `npx shadcn@latest add chart` |

## Edge cases & rules

1. Custom range: validate `from <= to` and cap the range at 90 days to keep the query/chart sane; clamp silently rather than erroring.
2. A day with zero attendance rows still needs a `0` bar in the chart (don't just skip it) — fill gaps when building the by-day series from the range's date list, not from `rows` alone.
3. `total_minutes` is `null` while an employee is still clocked in (not clocked out yet) — exclude those rows from the average-hours calculation for that day rather than treating null as 0 (would skew the average down).
4. Employees with zero attendance in the whole range still appear in the per-employee table with `0` days / `0` hours — don't filter them out, that's useful signal ("who hasn't shown up at all this period").

## Verification checklist

- [ ] `/admin/stats` redirects to `/admin/login` when not authenticated (same guard as other admin pages)
- [ ] Default view (7 days) shows a non-empty chart when there's at least one attendance row in the last week
- [ ] Switching to 30 days changes the data without a full page reload feel (Server Component re-render via nav is fine)
- [ ] Custom range with `from > to` doesn't crash — clamps or shows a validation message
- [ ] A day with zero clock-ins renders as a `0` bar, not a gap
- [ ] Per-employee table includes employees with zero attendance in the range
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Late/early-leave analytics once the 8:30–16:30 policy is enforced (seeds a future PLAN)
- PDF/Excel export of this page
- Per-employee drill-down page

## Rollback plan

Confined to: new files under `src/app/admin/stats/` and `src/components/admin/`, the two nav-link additions, and the `recharts`/`chart.tsx` dependency addition. Revert those + `npm uninstall recharts` to fully undo.
