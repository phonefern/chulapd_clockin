# PLAN-008: LINE OA Text-Message Keyword Reply

## Overview

The webhook at [api/line/webhook/route.ts](../src/app/api/line/webhook/route.ts) currently only handles the `follow` event (welcome message on adding the OA as a friend — [[PLAN]] work done earlier this session, not yet a numbered plan since it predates this doc series). It ignores `message` events entirely — if an employee types anything to the OA, nothing happens. The user asked for this directly: *"ถ้าผู้ใช้พิมพ์ข้อความใน line oa แล้วจะบอก result อะไรสักอย่างมาครับ"*.

**Reason for change:** a chat-based quick-check ("how many hours have I worked this month?") is lower friction than opening the LIFF app for some employees, and gives the OA a reason to feel "alive" beyond the Rich Menu button.

## Related plans

- [[PLAN-007]] — **hard dependency**: this plan calls the exact same `getEmployeeMonthSummary()` helper introduced there, so the numbers a chat reply gives match what the employee sees in the LIFF "ประวัติของฉัน" panel. Land PLAN-007 first.

## Scope

**In scope:** a small, fixed keyword set (Thai), case-insensitive, whitespace-trimmed exact/contains match — not a general NLU/AI bot:

| User types (contains) | Reply |
|---|---|
| `วันนี้` or `สถานะ` | Today's status: not-yet-clocked-in / clocked-in-since-HH:mm / clocked-out-HH:mm–HH:mm |
| `เดือนนี้` or `ชั่วโมง` or `สรุป` | This month's summary: days present, total hours, missing-clock-out count (from `getEmployeeMonthSummary`) |
| anything else, or sender not found in `employees` | Help text: list of the two keywords above, plus a reminder to use the Rich Menu / LIFF link for actually clocking in/out |

**Out of scope:**
- Free-text/NLU understanding — fixed keyword matching only, by design (predictable, no AI cost, no hallucination risk on something people may treat as an official record)
- Two-way conversation / multi-turn flows (e.g. "request a correction via chat") — the correction workflow, if built, belongs to `attendance_adjustments` (seeded as a future plan in [[PLAN-005]]) with a proper form, not free-text chat parsing
- Rich/Flex message replies — plain text is enough for this scope; revisit only if the plain-text reply reads poorly in practice

## Preflight checks

```bash
# confirm the webhook doesn't already branch on message events
grep -n "event.type" src/app/api/line/webhook/route.ts   # expect: only "follow" today

# confirm PLAN-007's helper signature before wiring a second caller
cat src/lib/attendanceStats.ts
```

## Data model / Fetch strategy

No schema change. On a `message`/`text` event:

```ts
if (event.type === "message" && event.message?.type === "text" && event.replyToken) {
  const supabase = getSupabaseAdmin();
  const lineUserId = event.source?.userId;

  const { data: employee } = lineUserId
    ? await supabase.from("employees").select("id, name, display_name").eq("line_user_id", lineUserId).maybeSingle()
    : { data: null };

  if (!employee) {
    await replyLineMessage(event.replyToken, NOT_REGISTERED_TEXT); // nudges to the LIFF link, same tone as the follow-event welcome message
    continue;
  }

  const text = event.message.text.trim();
  // match against the keyword table above, call getEmployeeMonthSummary /
  // a small getEmployeeTodayStatus() helper, format the Thai reply
}
```

`getEmployeeTodayStatus(supabase, employeeId)` is a small new helper alongside `getEmployeeMonthSummary` in [attendanceStats.ts](../src/lib/attendanceStats.ts) (added by [[PLAN-007]]) — single-row lookup on `attendance` for `work_date = todayInBangkok()`.

## UI structure

Not applicable — this is a chat-only feature. Example exchange:

```text
Employee: เดือนนี้
Bot:      เดือนสิงหาคม 2569 ของคุณ Fone
          มาทำงาน 18 วัน
          รวม 142:30 ชม.
          ลืม Clock out 1 วัน
```

## Files to create / modify

| File | Change |
|---|---|
| [src/app/api/line/webhook/route.ts](../src/app/api/line/webhook/route.ts) | Add a `message`/`text` branch alongside the existing `follow` branch; keyword matching + reply composition |
| [src/lib/attendanceStats.ts](../src/lib/attendanceStats.ts) *(from PLAN-007)* | Add `getEmployeeTodayStatus()` |
| `src/lib/lineReplyText.ts` *(new)* | Pure functions formatting the Thai reply strings (today-status text, month-summary text, help text, not-registered text) — kept separate from the route so the exact wording can be tuned/tested without touching webhook plumbing |

## Edge cases & rules

1. LINE sends webhook events in a batch (`events: [...]`) — process each independently; one failing reply (network error to LINE's reply API) must not stop the others in the same batch from being attempted (wrap each event handler in its own try/catch, same pattern already used for the `follow` branch).
2. A `replyToken` is single-use and expires quickly (LINE docs: ~1 minute) — do the DB lookups *before* attempting the reply, and don't retry a failed reply (retrying would need a fresh token from a new incoming event anyway).
3. Sender not found in `employees` (friended the OA but never opened the LIFF app) → the not-registered nudge, never a raw error or silence.
4. Keyword matching must not false-positive on the LIFF welcome/reminder messages *we* send (not an issue since we only match on **incoming** `message` events, but worth a comment in code so a future edit doesn't wire this branch to our own outgoing pushes by mistake).
5. This webhook is a single `POST` route already shared with the `follow` handling — keep both branches in the same file (don't split into separate webhook endpoints; LINE only supports one webhook URL per channel).

## Verification checklist

- [ ] Typing "วันนี้" before clocking in today replies with the not-yet-clocked-in message
- [ ] Typing "วันนี้" after clocking in replies with the correct clock-in time
- [ ] Typing "เดือนนี้" replies with numbers matching the employee's own `/admin`-visible record for the month
- [ ] Typing an unrecognized message replies with the help text, not silence or an error
- [ ] Messaging from a LINE account that's never opened the LIFF app gets the not-registered nudge with the LIFF link
- [ ] A batch webhook payload with multiple events (e.g. `follow` + `message` together) processes both without one blocking the other
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- Free-text correction requests via chat (belongs to the `attendance_adjustments` workflow, not this plan)
- Flex Message replies (nicer formatting) if plain text proves insufficient in practice

## Rollback plan

Confined to: the `message` branch added to [src/app/api/line/webhook/route.ts](../src/app/api/line/webhook/route.ts), the new `src/lib/lineReplyText.ts`, and the `getEmployeeTodayStatus` addition to `attendanceStats.ts`. The existing `follow` branch is untouched. Revert those to fully undo; no schema or env changes.
