# Calendar, Settings, and Mobile Redesign

## Goal

Make the calendar the primary workspace, surface future classes before the grid, move calendar operations into the top navigation, give Attendance a first-class mobile tab, and bring Settings into the same visual system. Preserve all existing timetable, attendance, export, authentication, and event-management behavior.

## Approved direction

The approved design is a dark transit-operations workspace with restrained borders and shadows, strong information hierarchy, and course color used as a narrow semantic rail rather than a glow. Desktop remains dense enough for a timetable; mobile changes structure instead of shrinking the desktop layout.

The brand asset is standardized as `public/vtc-timetable.svg`. Existing application-icon metadata and visible brand references use that exact path. Raster icon sizes may remain for platform metadata where required.

## Desktop calendar

The top navigation contains the application logo and name, `Manage Events`, `Calendar Tools`, and the user menu. `Manage Events` opens the existing unattended-event workflow. `Calendar Tools` opens a compact menu containing semester selection and `.ics` export. These operations are removed from the sidebar.

The sidebar is limited to course navigation, attendance summaries, the attendance grid link, subscription/help actions, and schedule synchronization. It must not duplicate event-management or calendar-export controls.

Above the calendar, an Upcoming Classes strip displays the next three future class events after applying the selected semester filter. Events are sorted by start time. Canceled events and Moodle deadlines are excluded. Each card shows start time, weekday/date, course code/title, duration, and room when present. Selecting a card opens the existing event-details workflow.

The calendar keeps Month, Work Week, Day, and Agenda views. Grid lines remain low contrast, today and the current-time line remain visible, and course blocks use a four-pixel color rail with readable text. Calendar height receives priority over auxiliary panels.

## Mobile calendar

Mobile uses a dedicated layout at the existing responsive breakpoint:

- The top bar contains the hamburger button, `vtc-timetable.svg`, page title, and user menu.
- `Manage Events` and `Calendar Tools` appear as two full-width, 44-pixel-minimum action buttons directly below the top bar.
- Upcoming Classes is a horizontally scrollable, scroll-snapping card row.
- Day view is the initial mobile view because a five-column week is not legible at phone width. Users can still select Month, Week, Day, or Agenda.
- Course and attendance navigation remains available from the drawer, but Attendance is also promoted to the persistent mobile navigation.

The mobile navigation has Calendar, Attendance, and More destinations. Calendar and Attendance preserve their state while switching during the current page session. More opens the existing drawer for course navigation, sync, subscription, help, and account destinations.

## Mobile attendance

Attendance is a first-class mobile tab, not a compressed copy of the desktop sidebar. It contains:

- the existing attendance-grid link;
- total attendance, maximum possible rate, and pass/fail status;
- semester accordions with course count;
- per-course status badges, current rate, progress, class count, and maximum possible rate.

Selecting a course opens a full-screen mobile detail surface. Desktop continues using the existing modal. The mobile detail surface contains the course title/status, on-time/late/absent counts, conducted and remaining counts, current and maximum possible rate, semester summaries, and the chronological attendance history. A visible back/close control returns to the same scroll position in the Attendance tab.

## Settings

Settings uses the same application top bar, typography, surfaces, borders, and responsive tokens as the calendar. Existing settings behavior is preserved and reorganized into four scannable groups:

1. Account: Discord identity, masked student ID, and login methods.
2. VTC connection: site/campus, programme, print quota, refresh state, and token errors.
3. Login and security: email and password update form with existing validation and result messages.
4. Stored data: the existing two-step clear-data operation in a distinct danger surface.

Desktop uses a compact settings navigation rail and a two-column card grid where content permits. Mobile uses horizontally scrollable category tabs and one-column cards. Tabs scroll to their associated section; they do not introduce duplicate settings state or new server actions.

## Component boundaries

- `TopNavbar` owns only brand, layout, and user navigation; it accepts a calendar-actions region from the authenticated calendar page.
- A focused calendar-actions component owns the Manage Events trigger and Calendar Tools menu, including export state.
- An Upcoming Classes component receives already-filtered events and emits the selected event.
- Mobile navigation and Attendance presentation are responsive client components that reuse the existing attendance data types and modal/detail content.
- Settings continues to use the existing settings and user actions. The redesign changes presentation, not server contracts.
- Shared colors, focus styles, spacing, touch targets, modal layers, and responsive rules remain token-driven in `globals.css`.

## Data and interaction rules

- Future classes are derived from stable event fields and timestamps. VTC lecture UUIDs are never used as persistent identity.
- Semester filtering drives both the calendar and Upcoming Classes.
- Event deletion continues through the existing authenticated actions and refresh callback.
- Calendar export remains semester `.ics` export only. No CSV or Excel export is introduced.
- All buttons have visible focus states, descriptive accessible names, and at least 44-by-44-pixel mobile hit areas.
- User-visible additions are provided in English and Traditional Chinese.
- Loading, empty, success, and error states remain visible; failures are not converted into success states.

## Validation

- Run targeted ESLint for every changed source component and locale file.
- Run `bun run build` to verify Vinext client/server boundaries and production bundling.
- Verify calendar and Settings layouts at 375, 768, 1024, and 1440 pixels.
- Verify the mobile Attendance tab, full-screen course detail, drawer, action menus, and modal stacking.
- Verify keyboard focus order, Escape/close behavior, reduced-motion behavior, and dark/light contrast.
- Confirm the existing event-management, semester export, attendance-grid link, course-detail selection, Settings form, and clear-data workflows still call their original actions.
