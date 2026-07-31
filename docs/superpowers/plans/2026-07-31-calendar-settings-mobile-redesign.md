# Calendar, Settings, and Mobile Redesign Implementation Plan

> **For AI agent workers:** Required sub-skill: use superpowers:executing-plans to implement this plan. Track each step with the checkbox syntax below.

**Goal:** Implement the approved calendar-first desktop dashboard, mobile Calendar and Attendance tabs, responsive attendance detail, Settings layout, localization, and standardized timetable logo.

**Architecture:** Keep the authenticated home page as the owner of event, course, attendance, calendar-view, and selected-event state. Add focused presentational components for calendar actions, upcoming classes, and mobile attendance; reuse the existing actions and modals. Settings retains its server-action contracts and state logic while its returned layout is reorganized into responsive navigation and cards.

**Tech stack:** React 19, TypeScript, Vinext/Vite, Tailwind CSS v4, next-intl, react-big-calendar, existing server actions.

---

## File structure

- Create `src/components/CalendarTopActions.tsx`: top-nav Manage Events trigger and semester ICS menu.
- Create `src/components/UpcomingClasses.tsx`: sorted next-three future classes and event selection.
- Create `src/components/MobileAttendanceView.tsx`: mobile attendance tab and course selection.
- Create `src/components/MobileBottomNav.tsx`: Calendar, Attendance, and More navigation.
- Modify `src/app/[locale]/page.tsx`: integrate desktop/mobile views and derive filtered events once.
- Modify `src/components/TopNavbar.tsx`: accept an action region and use the standardized brand asset.
- Modify `src/components/Sidebar.tsx`: remove duplicated Manage Events and Calendar Tools controls.
- Modify `src/components/AttendanceModal.tsx`: provide a full-screen mobile detail surface.
- Modify `src/components/TimetableCalendar.tsx` and `src/components/CalendarHeader.tsx`: preserve readable desktop views and mobile Day behavior.
- Modify `src/app/[locale]/settings/page.tsx`: responsive settings navigation and grouped cards.
- Modify `src/app/globals.css`: dashboard, action menu, upcoming strip, mobile tabs, attendance, and Settings styles.
- Modify `messages/en.json` and `messages/zh-HK.json`: all new visible labels.
- Rename `public/vtc_timetable_icon.svg` to `public/vtc-timetable.svg` and update `src/app/layout.tsx`.

### Task 1: Brand and localized UI vocabulary

- [ ] Rename the SVG asset to `public/vtc-timetable.svg` without changing its artwork.
- [ ] Update metadata and navbar references to `/vtc-timetable.svg`.
- [ ] Add paired English and Traditional Chinese keys for Manage Events, Calendar Tools, upcoming classes, mobile navigation, Settings groups, and attendance summaries.
- [ ] Run `bunx eslint src/components/TopNavbar.tsx src/app/layout.tsx` and confirm zero errors.

### Task 2: Calendar operations and future classes

- [ ] Create `CalendarTopActions` using `ManageEventsModal` and `exportSemesterIcs`; keep export restricted to semester `.ics` files.
- [ ] Create `UpcomingClasses` that filters `start > now`, excludes canceled events and deadlines, sorts by `start`, and renders at most three cards.
- [ ] Pass the action region into `TopNavbar`, place upcoming classes above `TimetableCalendar`, and use the same semester-filtered event list for both.
- [ ] Remove `CalendarToolsCard` and `ManageEventsSection` from `Sidebar` without changing sync, subscription, help, courses, or attendance.
- [ ] Run `bunx eslint src/components/CalendarTopActions.tsx src/components/UpcomingClasses.tsx src/components/TopNavbar.tsx src/components/Sidebar.tsx "src/app/[locale]/page.tsx"` and record pre-existing page/sidebar warnings separately.

### Task 3: Mobile Calendar and Attendance navigation

- [ ] Create `MobileBottomNav` with Calendar, Attendance, and More controls and accessible selected state.
- [ ] Create `MobileAttendanceView` using existing `HybridAttendanceStats`, semester breakdowns, attendance-grid navigation, and `AttendanceModal` selection.
- [ ] Add `mobileTab` state to the home page, open the existing drawer from More, and render Calendar or Attendance without duplicating server requests.
- [ ] Select Day view on the first mobile render while preserving user-selected view changes afterward.
- [ ] Add horizontally scrollable upcoming cards, 44-pixel mobile controls, fixed bottom navigation, and content insets in `globals.css`.
- [ ] Run targeted ESLint for the new mobile components and home page.

### Task 4: Responsive attendance detail and Settings

- [ ] Add semantic classes to `AttendanceModal` so it becomes a full-screen, scrollable mobile detail surface while remaining a centered desktop modal.
- [ ] Reorganize Settings into Account, VTC Connection, Login & Security, and Stored Data sections while preserving `getUserSettings`, live VTC information, password update, masked student ID, and two-step data clearing.
- [ ] Add desktop settings navigation, a responsive card grid, horizontally scrollable mobile category links, and shared app branding.
- [ ] Confirm every existing Settings action and message remains wired to its original handler.
- [ ] Run `bunx eslint src/components/AttendanceModal.tsx "src/app/[locale]/settings/page.tsx"` and record only pre-existing hook findings separately.

### Task 5: Integration verification

- [ ] Run `git diff --check` and remove whitespace or merge artifacts.
- [ ] Run targeted ESLint across all changed UI and locale files; require zero newly introduced errors.
- [ ] Run `bun run build`; require exit code 0 and a complete Vinext route build.
- [ ] Inspect the diff to confirm no API, database, authentication, event identity, or export-format behavior changed.
- [ ] Report repository-wide lint failures from generated `.vercel` output separately if they remain.
