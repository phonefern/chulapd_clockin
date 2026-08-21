# PLAN-001: Branding — "ChulaPD Attendance"

## Overview

The app currently ships with Next.js's default scaffold branding: `<title>Create Next App</title>`, the default Next.js favicon, and no visible product name anywhere in the UI. The LINE OA and Rich Menu are already branded ("ChulaPD Attendance", green `#16a34a`), but the web app (employee LIFF page + admin dashboard) has none of that identity.

**Reason for change:** the product now has real users (clinic staff) and a public-facing admin login — it should look like a finished internal tool, not a scaffold.

A logo mark has already been designed and generated (green rounded-square, clock + checkmark, matching the Rich Menu's brand color) and placed at:
- [public/logo-mark.svg](../public/logo-mark.svg) — source vector
- [src/app/icon.png](../src/app/icon.png) — 512×512, picked up automatically by Next.js's `icon` file convention
- [src/app/apple-icon.png](../src/app/apple-icon.png) — 180×180, picked up automatically by the `apple-icon` file convention

These two PNGs need no wiring — Next.js auto-injects the `<link rel="icon">` / `<link rel="apple-touch-icon">` tags from their presence alone. This plan is about wiring the **name** and the mark into visible UI chrome.

## Related plans

None yet — this is the first plan in this project's `docs/` series.

## Scope

**In scope:**
- `<title>` / metadata rename to "ChulaPD Attendance" (root layout)
- Per-page `<title>` overrides where it makes sense (Admin login, Admin dashboard, Admin employees) using Next's nested metadata
- Add the logo mark + wordmark to the employee LIFF page header, the admin login card, and the admin dashboard header
- Remove the old default Next.js `src/app/favicon.ico` (superseded by `icon.png`) to avoid two conflicting icons

**Out of scope:**
- Changing the LINE OA display name or Rich Menu (already correct)
- A full design system / color token rename — reuse the existing `#16a34a` green already baked into `globals.css` and the shadcn theme
- Custom domain / PWA manifest (`manifest.json`) — can be a future PLAN if an installable home-screen app is wanted later

## Preflight checks

```bash
# confirm the generated assets are present and non-empty
ls -la public/logo-mark.svg src/app/icon.png src/app/apple-icon.png

# confirm nothing already overrides metadata.title per-route (avoid clobbering)
grep -rn "metadata" src/app --include="*.tsx"
```

## Files to create / modify

| File | Change |
|---|---|
| [src/app/layout.tsx](../src/app/layout.tsx) | Update `export const metadata` — `title: "ChulaPD Attendance"`, add a short `description` |
| [src/app/favicon.ico](../src/app/favicon.ico) | Delete — `icon.png` supersedes it |
| [src/app/page.tsx](../src/app/page.tsx) | Add small header row above the date line: logo mark (24–32px) + "ChulaPD Attendance" wordmark text |
| [src/app/admin/login/page.tsx](../src/app/admin/login/page.tsx) | Replace the plain `<CardTitle>ระบบลงเวลาทำงาน</CardTitle>` with logo mark above the title, and set `export const metadata = { title: "เข้าสู่ระบบ · ChulaPD Attendance" }` |
| [src/app/admin/page.tsx](../src/app/admin/page.tsx) *(also touched by PLAN-002)* | Add logo mark next to the `WORKFORCE OVERVIEW` eyebrow in the header; `export const metadata = { title: "Attendance วันนี้ · ChulaPD Attendance" }` |
| [src/app/admin/employees/page.tsx](../src/app/admin/employees/page.tsx) *(also touched by PLAN-004)* | Same metadata pattern: `title: "พนักงาน · ChulaPD Attendance"` |

## UI structure

Employee LIFF page header (top of [page.tsx](../src/app/page.tsx), above `<p className="date">`):

```text
┌─────────────────────────────┐
│ [🟢] ChulaPD Attendance      │
│                               │
│ 19 สิงหาคม 2569               │
│ ...                           │
```

Admin login card ([admin/login/page.tsx](../src/app/admin/login/page.tsx)), inside `<CardHeader>`, above `<CardTitle>`:

```text
┌───────────────────┐
│      [🟢]           │
│  ChulaPD Attendance │
│  เข้าสู่ระบบสำหรับผู้ดูแล │
│  [Email____________]│
│  [Password_________]│
│  [   เข้าสู่ระบบ    ]│
└───────────────────┘
```

## Edge cases & rules

1. Use `next/image` for the logo in page headers (it's a static local file) — not a plain `<img>` — for correct optimization.
2. Keep the logo small (24–40px) in headers; it's a supporting mark, not a hero image.
3. Don't touch `NEXT_PUBLIC_LIFF_ID`, the Rich Menu, or any LINE-side branding — those are already correct and out of scope.

## Verification checklist

- [ ] Browser tab shows "ChulaPD Attendance" (or the per-page override) on `/`, `/admin/login`, `/admin`, `/admin/employees`
- [ ] Browser tab favicon is the new green clock+check mark, not the old Next.js icon
- [ ] Logo renders correctly in light and dark system theme (the mark has a solid green background so it should be theme-agnostic — verify it doesn't look broken on dark backgrounds)
- [ ] `npx tsc --noEmit` and `npx eslint` clean

## Out-of-scope follow-ups

- PWA manifest + "Add to Home Screen" support (seed for a future PLAN if wanted)
- Full design-token pass (spacing/typography scale) beyond what shadcn already provides

## Rollback plan

Confined to: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/admin/login/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/employees/page.tsx`, plus the new asset files. Revert those files / delete the new assets to fully undo.
