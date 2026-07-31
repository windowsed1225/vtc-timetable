# Attendance Entry Calendar Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the desktop Student Attendance Entry shortcut into the Calendar Tools popover without changing the destination page or mobile attendance navigation.

**Architecture:** `CalendarTopActions` will own the utility link and reuse the existing `attendanceGrid.navLabel` translation. The duplicate desktop link will be removed from `Sidebar`; small scoped CSS will make the new popover row distinct and keyboard-visible.

**Tech Stack:** React 19, Vinext, next-intl, Next Link, CSS, Bun test runner

## Global Constraints

- Route to the existing `/attendance-grid` page.
- Keep the mobile attendance navigation and calendar export behavior unchanged.
- Use existing English and `zh-HK` translation keys; do not add duplicate copy.
- Render the destination as a real link with hover and focus-visible states.

---

### Task 1: Move attendance navigation into Calendar Tools

**Files:**
- Create: `src/components/calendar-tools-navigation.test.ts`
- Modify: `src/components/CalendarTopActions.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: existing `attendanceGrid.navLabel` translation and `/attendance-grid` route
- Produces: one `.calendar-tools-link` anchor in Calendar Tools and no desktop Sidebar attendance-grid anchor

- [ ] **Step 1: Write the failing structural regression test**

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("attendance entry navigation", () => {
  const topActions = readFileSync(new URL("./CalendarTopActions.tsx", import.meta.url), "utf8");
  const sidebar = readFileSync(new URL("./Sidebar.tsx", import.meta.url), "utf8");

  test("lives in Calendar Tools instead of the desktop Sidebar", () => {
    expect(topActions).toContain('href="/attendance-grid"');
    expect(topActions).toContain('useTranslations("attendanceGrid")');
    expect(sidebar).not.toContain('href="/attendance-grid"');
  });
});
```

- [ ] **Step 2: Run the regression test and verify it fails**

Run: `bun test src/components/calendar-tools-navigation.test.ts`

Expected: FAIL because `CalendarTopActions.tsx` does not yet contain the attendance route and `Sidebar.tsx` still does.

- [ ] **Step 3: Implement the navigation move**

In `CalendarTopActions.tsx`, import `Link`, create `tAttendanceGrid = useTranslations("attendanceGrid")`, and add this as the first popover row:

```tsx
<Link href="/attendance-grid" className="calendar-tools-link">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75zM3.75 9h16.5M3.75 14.25h16.5M9 3.75v16.5M15 3.75v16.5" />
  </svg>
  <span>{tAttendanceGrid("navLabel")}</span>
  <span aria-hidden="true">→</span>
</Link>
```

Remove only the desktop `Link href="/attendance-grid"` block from the Attendance section of `Sidebar.tsx`. Do not change `MobileAttendanceView.tsx`.

Add scoped styles in `globals.css`:

```css
.calendar-tools-link {
  display: grid;
  grid-template-columns: 18px 1fr auto;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  margin: -4px -4px 12px;
  padding: 8px 10px 12px;
  border-bottom: 1px solid var(--border-default);
  color: var(--foreground);
  font-size: 12px;
  font-weight: 650;
}
.calendar-tools-link svg { width: 17px; height: 17px; color: var(--accent-blue); }
.calendar-tools-link:hover { color: var(--accent-blue); }
.calendar-tools-link:focus-visible { border-radius: 8px; outline: 2px solid var(--accent-blue); outline-offset: 2px; }
```

- [ ] **Step 4: Run focused verification**

Run: `bun test src/components/calendar-tools-navigation.test.ts`

Expected: 1 pass, 0 fail.

Run: `bunx eslint src/components/CalendarTopActions.tsx src/components/Sidebar.tsx src/components/calendar-tools-navigation.test.ts`

Expected: exit 0.

Run: `bun run build`

Expected: production build completes successfully.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/components/calendar-tools-navigation.test.ts src/components/CalendarTopActions.tsx src/components/Sidebar.tsx src/app/globals.css
git commit -m "feat: move attendance entry into calendar tools"
```
