# PLAN-002: Admin Attendance — Live Refresh + Date Picker

## Overview

[src/app/admin/page.tsx](../src/app/admin/page.tsx) is a Server Component: it fetches today's attendance once per request and renders a static table. There is no way to (a) see updates without a manual browser reload, or (b) look at any day other than today. Both were explicitly requested: *"หน้า admin มันไม่ refresh ตาม db เหรอครับ"* and *"เพิ่ม button เวลาเลือกดูตาม date"*.

**Reason for change:** this page is meant to be left open on an office screen / checked periodically by an admin during the day — it needs to reflect new clock-ins without a manual reload, and admins need to review past days (e.g. for a payroll/print run) not just "today".

## Related plans

- [[PLAN-001]] — branding header touches the same file's `<header>` block; land PLAN-001 first or expect a small merge.
- [[PLAN-003]] — the new stats page will reuse the date-range query pattern introduced here.

## Scope

**In scope:**
- Date picker (native `<input type="date">`) driven by a `?date=YYYY-MM-DD` search param, defaulting to today (Asia/Bangkok)
- "วันนี้" quick-jump button, and simple prev/next-day arrows
- Auto-refresh: re-fetch on an interval while the tab is open, **only when viewing today** (refreshing a historical date is pointless — it won't change)
- "อัปเดตล่าสุด HH:MM:SS" indicator + manual refresh button
- Keep it a Server Component for the data fetch (no architecture change, no RLS/Realtime needed — see rejected alternative below)

**Out of scope:**
- Supabase Realtime / websocket push — **rejected**: our admin session is a custom signed cookie (see [adminSession.ts](../src/lib/adminSession.ts)), not a Supabase Auth JWT held client-side. Realtime's authorization model relies on RLS evaluated against a Supabase Auth JWT over the websocket connection; wiring that up would mean either (a) exposing `attendance` schema to `anon`/`authenticated` via new RLS policies — undoing the deliberate default-deny posture set when the schema was created — or (b) minting a parallel Supabase Auth session just for Realtime. Polling via `router.refresh()` (below) gets 90% of the value with none of that risk.
- Filtering by employee / status on this page — the employees list already exists at `/admin/employees`; a combined filter UI can be a future PLAN if needed.
- Date-range (multi-day) view — this plan is single-day only; PLAN-003 covers multi-day aggregates.

## Preflight checks

```bash
# confirm current page has no searchParams handling yet
grep -n "searchParams" src/app/admin/page.tsx   # expect: no match

# confirm todayInBangkok() is the only date helper so far
cat src/lib/workDate.ts
```

## Data model / Fetch strategy

No schema change. Same query as today, parameterized by `workDate` instead of hardcoded `todayInBangkok()`:

```ts
const workDate = resolvedDate; // from searchParams, validated YYYY-MM-DD, default todayInBangkok()

const { data, error } = await supabase
  .from("attendance")
  .select(
    "id, clock_in_at, clock_out_at, total_minutes, status, employees(name, display_name, employee_code)"
  )
  .eq("work_date", workDate)
  .order("clock_in_at", { ascending: true });
```

Validate the incoming `date` search param with a strict regex (`/^\d{4}-\d{2}-\d{2}$/`) before using it in the query — reject/ignore anything else and fall back to today, since it flows from the URL.

## UI structure

```text
┌──────────────────────────────────────────────┐
│ WORKFORCE OVERVIEW                             │
│ Attendance   [<] 19 สิงหาคม 2569 [>]  [วันนี้]  │
│                          อัปเดตล่าสุด 14:32:07 [⟳]│
├──────────────────────────────────────────────┤
│ [stat cards row — unchanged]                   │
├──────────────────────────────────────────────┤
│ [table — unchanged]                            │
└──────────────────────────────────────────────┘
```

The `[<] date [>]` + `[วันนี้]` cluster replaces the static `<p className={styles.date}>` line in the current header.

## Files to create / modify

| File | Change |
|---|---|
| [src/app/admin/page.tsx](../src/app/admin/page.tsx) | Accept `searchParams: Promise<{ [key: string]: string \| string[] \| undefined }>`; parse/validate `date`; pass to the query; render date-nav controls *(new)* |
| `src/components/admin/date-nav.tsx` *(new)* | Client component: `<input type="date">` + prev/next/today buttons, updates the URL via `useRouter().push()` / `useSearchParams()` |
| `src/components/admin/auto-refresh.tsx` *(new)* | Client component, renders nothing visible on its own (or just the "last updated" timestamp + refresh icon button); `useEffect` interval calling `router.refresh()` every 15s, **only mounts/runs when `isToday` is true** (pass as prop from the server page) |
| [src/app/admin/admin.module.css](../src/app/admin/admin.module.css) | Add styles for the date-nav cluster (reuse existing `.date`/`.header` classes as a base) |

## Edge cases & rules

1. `date` search param present but malformed (not `YYYY-MM-DD`, or an invalid calendar date) → silently fall back to today, don't error the page.
2. `date` in the future → allowed to render (will just show an empty table with the existing "ยังไม่มีใครลงเวลาวันนี้" empty state — reuse as-is, text is generic enough).
3. Auto-refresh must **not** run when the browser tab is hidden (`document.visibilityState`) — pause the interval on `visibilitychange` to avoid wasted requests when the admin has switched tabs.
4. Auto-refresh must stop entirely when `date !== todayInBangkok()` — no point polling a frozen historical day.
5. `router.refresh()` re-runs the Server Component; it does **not** reset scroll position or component state elsewhere on the page, so this is safe to call frequently.

## Verification checklist

- [ ] `/admin` with no query param shows today, same as before
- [ ] `/admin?date=2026-08-15` shows that day's data (test against a date you know has rows)
- [ ] `/admin?date=garbage` falls back to today without erroring
- [ ] Prev/next/today buttons update the URL and the table
- [ ] Leaving `/admin` open on today and inserting a test row (e.g. via the employee LIFF page in another tab) makes it appear within ~15s without a manual reload
- [ ] Switching to a past date stops the auto-refresh (check network tab — no repeated requests)
- [ ] Switching browser tab away and back doesn't cause a burst of missed/queued refreshes
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Combined employee/status filter on this page
- True push-based live updates (would require the Realtime/RLS tradeoff discussed above — revisit only if 15s polling proves too slow for real usage)

## Rollback plan

Confined to: `src/app/admin/page.tsx`, `src/app/admin/admin.module.css`, and the two new files under `src/components/admin/`. Revert/delete to fully undo; no schema or env changes involved.
