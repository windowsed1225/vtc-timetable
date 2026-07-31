# Transit Calendar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved course-code-first Transit calendar for desktop and mobile while preserving all existing calendar data and interactions.

**Architecture:** Keep `react-big-calendar` as the calendar engine. The localized page continues to own date, view, semester filter, and filtered events; `CalendarHeader` receives navigation/filter props; `UpcomingClasses` handles only compact upcoming presentation; and a new `CalendarEventCard` owns course-event content hierarchy. Styling remains in the shared token-based stylesheet.

**Tech Stack:** React 19, TypeScript 5.9 strict mode, Vinext/Vite, `react-big-calendar`, Day.js, `next-intl`, Tailwind CSS v4 utilities, shared CSS variables.

## Global Constraints

- Do not replace `react-big-calendar` or add dependencies.
- Do not change timetable synchronization, persistence, server actions, database models, authentication, attendance, exports, or event deletion.
- Desktop defaults to Work Week; mobile defaults to Day.
- Course code and time are the permanent event-card anchors; title and room appear only when space permits.
- Use course color as a narrow route edge and subtle tint, not a saturated event fill.
- Never use the upstream random lecture UUID as a persistent, deduplication, cache, or React identity.
- Add all new visible copy to both `messages/en.json` and `messages/zh-HK.json`.
- Preserve keyboard focus, pressed-state semantics, non-color status indicators, 44-pixel mobile targets, and reduced-motion support.
- The repository has no relevant automated UI test script; do not invent or claim one. Use focused ESLint, locale parsing, production build, and manual viewport checks.

---

## File Structure

- Create `src/components/CalendarEventCard.tsx`: render course and deadline event content with stable semantic class names.
- Modify `src/components/TimetableCalendar.tsx`: delegate event content, calculate duration-density classes, and retain calendar navigation/status configuration.
- Modify `src/components/CalendarHeader.tsx`: integrate semester selection and add the mobile weekday strip.
- Modify `src/components/UpcomingClasses.tsx`: render the compact zero-state row or one-to-three upcoming chips.
- Modify `src/app/[locale]/page.tsx`: remove the standalone semester toolbar and pass filter state into `TimetableCalendar`.
- Modify `src/app/globals.css`: implement the Transit grid, event, toolbar, Upcoming, status, and mobile treatments.
- Modify `messages/en.json` and `messages/zh-HK.json`: add compact Upcoming and calendar-status labels.

### Task 1: Calendar Header and Filter Contract

**Files:**
- Modify: `src/components/CalendarHeader.tsx`
- Modify: `src/components/TimetableCalendar.tsx`
- Modify: `src/app/[locale]/page.tsx`

**Interfaces:**
- `TimetableCalendar` consumes `semesterFilter: string` and `onSemesterFilterChange: (semester: string) => void`.
- `CalendarHeader` consumes those same values plus its existing date, view, navigation, and view-change props.
- `CalendarHeader` produces navigation, view-change, filter-change, and mobile date-selection callbacks only; it does not filter events.

- [ ] **Step 1: Extend the `TimetableCalendar` interface**

Add these props and forward them to `CalendarHeader`:

```tsx
interface TimetableCalendarProps {
    events: CalendarEvent[];
    view: View;
    date: Date;
    semesterFilter: string;
    onSemesterFilterChange: (semester: string) => void;
    onViewChange: (view: View) => void;
    onNavigate: (date: Date) => void;
    onSelectEvent?: (event: CalendarEvent) => void;
    locale?: string;
}
```

- [ ] **Step 2: Extend the `CalendarHeader` contract**

Use exact props:

```tsx
interface CalendarHeaderProps {
    date: Date;
    view: ViewType;
    semesterFilter: string;
    onSemesterFilterChange: (semester: string) => void;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
    onDateSelect: (date: Date) => void;
    onViewChange: (view: ViewType) => void;
}
```

Render the existing navigation on the left, month/year in the center, and a `.calendar-header-tools` wrapper containing the semester select and view switcher on the right.

- [ ] **Step 3: Add the mobile five-day strip**

Derive dates around the selected day without effects:

```tsx
const mobileDates = [-2, -1, 0, 1, 2].map((offset) =>
    dayjs(date).add(offset, "day").toDate()
);
```

Render buttons in `.calendar-mobile-dates`; use `dayjs(candidate).isSame(date, "day")` for `.is-active`, call `onDateSelect(candidate)`, and include an `aria-pressed` state.

- [ ] **Step 4: Remove the standalone page filter**

Delete `.semester-toolbar` JSX from the page. Keep the existing `semesterFilter` state, date-jump logic, and `filteredEvents` memo. Move the date-jump logic into a page callback passed as `onSemesterFilterChange`:

```tsx
const handleSemesterFilterChange = (semester: string) => {
    setSemesterFilter(semester);
    const now = new Date();
    if (semester === "SEM 1") {
        const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
        setDate(new Date(year, 8, 1));
    } else if (semester === "SEM 2") {
        setDate(new Date(now.getFullYear(), 0, 1));
    } else if (semester === "SEM 3") {
        setDate(new Date(now.getFullYear(), 4, 1));
    }
};
```

- [ ] **Step 5: Run focused lint**

Run:

```powershell
bunx eslint src/components/CalendarHeader.tsx src/components/TimetableCalendar.tsx src/app/[locale]/page.tsx
```

Expected: no new errors. If the page reports its documented pre-existing hook errors, verify `CalendarHeader.tsx` and `TimetableCalendar.tsx` independently and report page findings separately.

- [ ] **Step 6: Commit the header/filter task**

```powershell
git add src/components/CalendarHeader.tsx src/components/TimetableCalendar.tsx src/app/[locale]/page.tsx
git commit -m "feat: unify calendar navigation and filtering"
```

### Task 2: Course-First Event Card

**Files:**
- Create: `src/components/CalendarEventCard.tsx`
- Modify: `src/components/TimetableCalendar.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- `CalendarEventCard` consumes `{ event: CalendarEvent; density: "compact" | "medium" | "full" }`.
- `TimetableCalendar` calculates density from event duration and passes the event unchanged.
- CSS consumes `.calendar-event-card`, `.calendar-event-code`, `.calendar-event-time`, `.calendar-event-title`, and `.calendar-event-room`.

- [ ] **Step 1: Create `CalendarEventCard`**

Implement this component shape:

```tsx
interface CalendarEventCardProps {
    event: CalendarEvent;
    density: "compact" | "medium" | "full";
}

export default function CalendarEventCard({ event, density }: CalendarEventCardProps) {
    const time = `${dayjs(event.start).format("HH:mm")}–${dayjs(event.end).format("HH:mm")}`;
    const isCancelled = event.resource?.status === "CANCELED";

    return (
        <div className={`calendar-event-card density-${density}`}>
            <div className="calendar-event-primary">
                <strong className={isCancelled ? "is-cancelled" : ""}>
                    {event.resource?.courseCode || event.title}
                </strong>
                <time>{time}</time>
            </div>
            {density !== "compact" && (
                <span className="calendar-event-title">
                    {event.resource?.courseTitle || event.title}
                </span>
            )}
            {density === "full" && event.resource?.location && (
                <span className="calendar-event-room">{event.resource.location}</span>
            )}
        </div>
    );
}
```

Include an accessible adjusted indicator when `isAdjusted` is true. Keep cancelled meaning in text/decoration, not color alone.

- [ ] **Step 2: Delegate course-event rendering**

In `TimetableCalendar`, keep the existing deadline branch and replace the inline course JSX with `CalendarEventCard`. Calculate density:

```tsx
const durationMinutes = Math.max(0, dayjs(event.end).diff(event.start, "minute"));
const density = durationMinutes < 60 ? "compact" : durationMinutes < 120 ? "medium" : "full";
return <CalendarEventCard event={event} density={density} />;
```

- [ ] **Step 3: Simplify event inline styles**

Keep only values that must remain dynamic in `eventPropGetter`, including CSS custom properties for the course route color when needed. Move radius, padding, font size, hover, selected, finished, cancelled, and absent presentation into CSS classes.

- [ ] **Step 4: Add Transit event CSS**

Define:

```css
.rbc-event {
    border: 1px solid var(--calendar-event-border);
    border-left: 4px solid var(--event-route-color, var(--accent-blue));
    border-radius: 8px;
    background: color-mix(in srgb, var(--event-route-color, var(--accent-blue)) 9%, var(--calendar-event-bg));
    box-shadow: 0 4px 14px rgba(2, 8, 16, 0.16);
}
.calendar-event-primary {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
}
.calendar-event-primary strong { font-size: 12px; letter-spacing: 0.025em; }
.calendar-event-primary time { flex: none; color: var(--text-tertiary); font-size: 9px; }
.calendar-event-title,
.calendar-event-room { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

Add finished, cancelled, absent, selected, hover, and adjusted styles using existing status classes.

- [ ] **Step 5: Run focused lint**

```powershell
bunx eslint src/components/CalendarEventCard.tsx src/components/TimetableCalendar.tsx
```

Expected: exit code 0.

- [ ] **Step 6: Commit the event-card task**

```powershell
git add src/components/CalendarEventCard.tsx src/components/TimetableCalendar.tsx src/app/globals.css
git commit -m "feat: add course-first transit event cards"
```

### Task 3: Compact Upcoming States and Localization

**Files:**
- Modify: `src/components/UpcomingClasses.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh-HK.json`
- Modify: `src/app/globals.css`

**Interfaces:**
- `UpcomingClasses` keeps `{ events: CalendarEvent[]; onSelect: (event: CalendarEvent) => void }`.
- It produces `.upcoming-classes.is-empty` for zero events and `.upcoming-class-chip` buttons for one to three events.

- [ ] **Step 1: Add localized compact labels**

Add under `calendar`:

```json
"upcomingClear": "Calendar is clear",
"upcomingCompactEmpty": "No classes scheduled",
"currentTime": "Current time"
```

Add equivalent Traditional Chinese strings:

```json
"upcomingClear": "行事曆暫無安排",
"upcomingCompactEmpty": "沒有已安排的課堂",
"currentTime": "目前時間"
```

- [ ] **Step 2: Replace the large empty state**

When `upcoming.length === 0`, render:

```tsx
<section className="upcoming-classes is-empty" aria-labelledby="upcoming-classes-title">
    <span><strong id="upcoming-classes-title">{t("upcomingClasses")}</strong> · {t("upcomingCompactEmpty")}</span>
    <small>{t("upcomingClear")}</small>
</section>
```

- [ ] **Step 3: Render compact chips for upcoming events**

For one to three events, use `button.upcoming-class-chip` with time, course code, and optional room. Keep the existing chronological sort, status/deadline exclusions, selection callback, and stable composite key.

- [ ] **Step 4: Replace Upcoming CSS**

Desktop uses a single horizontal rail with three equal chips. Mobile uses horizontal scrolling and scroll snap. Empty state must be one row no taller than 36 pixels on desktop and 40 pixels on mobile.

- [ ] **Step 5: Validate locales and lint**

```powershell
bun -e "JSON.parse(await Bun.file('messages/en.json').text()); JSON.parse(await Bun.file('messages/zh-HK.json').text()); console.log('locale JSON valid')"
bunx eslint src/components/UpcomingClasses.tsx
```

Expected: `locale JSON valid`; ESLint exit code 0.

- [ ] **Step 6: Commit the Upcoming task**

```powershell
git add src/components/UpcomingClasses.tsx messages/en.json messages/zh-HK.json src/app/globals.css
git commit -m "feat: compact upcoming class states"
```

### Task 4: Transit Grid and Mobile Day Layout

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/CalendarHeader.tsx`
- Modify: `src/components/TimetableCalendar.tsx`

**Interfaces:**
- Existing `react-big-calendar` classes remain the grid integration boundary.
- `.calendar-mobile-dates` is hidden on desktop and shown at widths up to 768 pixels.

- [ ] **Step 1: Calm the desktop grid**

Adjust calendar CSS so hour boundaries use `var(--calendar-border)`, half-hour boundaries use a lower-contrast mixed color, headers use restrained uppercase labels, and `.rbc-today` uses a subtle blue tint. Preserve time-grid scrolling.

- [ ] **Step 2: Refine the current-time indicator**

Use a one-pixel warm red line and a leading circular marker:

```css
.rbc-current-time-indicator {
    height: 1px;
    background: var(--error);
    z-index: 5;
}
.rbc-current-time-indicator::before {
    content: "";
    position: absolute;
    left: -4px;
    top: -3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--error);
}
```

- [ ] **Step 3: Implement the mobile header composition**

At `max-width: 768px`, place compact navigation/date/view controls above `.calendar-mobile-dates`, hide the desktop-centered month treatment where redundant, preserve 44-pixel controls, and keep the semester select accessible without overflowing.

- [ ] **Step 4: Tune mobile event presentation**

Ensure Day view uses full available width; keep code/time readable; show title and room for normal two-hour classes; prevent the bottom navigation from covering the final calendar slots.

- [ ] **Step 5: Check Month and Agenda regressions**

Keep Month event pills compact and Agenda table rows readable. Scope Work Week/Day selectors carefully so the Transit time-grid styles do not make Month cards oversized.

- [ ] **Step 6: Run focused lint and production build**

```powershell
bunx eslint src/components/CalendarHeader.tsx src/components/TimetableCalendar.tsx src/components/CalendarEventCard.tsx src/components/UpcomingClasses.tsx
bun run build
```

Expected: ESLint exit code 0 and `Build complete`.

- [ ] **Step 7: Commit the responsive grid task**

```powershell
git add src/app/globals.css src/components/CalendarHeader.tsx src/components/TimetableCalendar.tsx
git commit -m "feat: refine transit calendar grid and mobile day view"
```

### Task 5: Final Verification and Requirement Audit

**Files:**
- Review: `docs/superpowers/specs/2026-07-31-transit-calendar-redesign-design.md`
- Review: all files changed in Tasks 1–4

**Interfaces:**
- No new interfaces; this task verifies the integrated feature.

- [ ] **Step 1: Run whitespace and locale checks**

```powershell
git diff --check
bun -e "JSON.parse(await Bun.file('messages/en.json').text()); JSON.parse(await Bun.file('messages/zh-HK.json').text()); console.log('locale JSON valid')"
```

Expected: no `git diff --check` output and `locale JSON valid`.

- [ ] **Step 2: Run focused ESLint**

```powershell
bunx eslint src/components/CalendarHeader.tsx src/components/TimetableCalendar.tsx src/components/CalendarEventCard.tsx src/components/UpcomingClasses.tsx
```

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

```powershell
bun run build
```

Expected: exit code 0 with `Build complete`.

- [ ] **Step 4: Perform manual viewport checks**

At approximately 1440×900, 1024×768, 768×1024, and 390×844, verify:

- Work Week desktop and Day mobile defaults
- Unified semester/filter toolbar
- Empty and populated Upcoming states
- Code/time/title/room hierarchy at different event durations
- Today tint and current-time indicator
- Upcoming, finished, cancelled, absent, adjusted, and deadline states
- Month, Week, Day, and Agenda switching
- Event and Upcoming-chip selection opens details
- Mobile date-strip navigation and bottom-nav clearance
- Keyboard focus and dismissal behavior

- [ ] **Step 5: Audit identity and scope**

Confirm no React key, memo identity, deduplication, or cache logic uses `resource.vtc_id`; confirm no server action, API, model, database, attendance, export, or deletion code changed.

- [ ] **Step 6: Commit any verification fixes**

If verification required changes:

```powershell
git add src/components src/app/globals.css messages
git commit -m "fix: polish transit calendar interactions"
```

If no changes were required, do not create an empty commit.
