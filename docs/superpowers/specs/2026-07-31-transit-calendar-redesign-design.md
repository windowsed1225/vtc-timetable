# Transit Calendar Redesign

## Objective

Redesign the timetable calendar so students can identify courses, times, and rooms quickly without losing the full-week overview. The result should feel calmer than the current grid, preserve calendar density, and work naturally on desktop and mobile.

The selected visual direction is **Balanced Focus / Transit Line**: restrained calendar chrome, course-code-first event cards, narrow route-color edges, and a compact Upcoming area.

## Scope

This redesign covers:

- Desktop Work Week calendar composition
- Mobile Day calendar composition
- Calendar toolbar and semester-filter placement
- Upcoming-class presentation
- Calendar event hierarchy and responsive truncation
- Current-day, current-time, cancelled, absent, and finished states
- Event selection and mobile detail presentation

It does not change timetable synchronization, stored data, attendance calculations, calendar exports, event deletion behavior, authentication, or database models.

## Desktop Structure

The calendar remains the primary workspace. Its vertical order is:

1. A unified calendar toolbar
2. A compact Upcoming row or chip rail
3. Weekday headers
4. The scrollable time grid
5. Optional quiet legend text where needed

### Unified toolbar

The toolbar contains:

- Previous, next, and Today controls on the left
- The current month and year centered
- Semester filter and Month / Week / Day / Agenda selector on the right

The existing standalone semester toolbar is removed. The semester filter continues to filter both Upcoming and calendar events through state owned by the page.

### Grid treatment

- Weekday columns remain equal width.
- Hour lines are visible but restrained.
- Half-hour lines use lower contrast than hour boundaries.
- The current day receives a subtle blue-tinted column background.
- The current-time indicator uses a thin warm red line and leading dot.
- Grid borders must not compete visually with event cards.
- The Work Week view remains the desktop default.

## Upcoming Classes

Upcoming classes never reserve a large empty panel.

- With zero future classes, render one quiet row stating that no classes are scheduled.
- With one to three future classes, render compact horizontally arranged chips.
- Each chip shows time, course code, and room when available.
- Selecting a chip opens the same event detail experience as selecting the event in the grid.
- Upcoming events remain sorted by start time and exclude cancelled events and Moodle deadlines.

## Event Card Hierarchy

The event card is course-code first.

Information priority is:

1. Course code
2. Time range
3. Short course title
4. Room
5. Lecturer and extended metadata in event details only

The course's assigned color appears as a narrow left route edge and a very subtle background tint. It does not fill the entire event with a saturated color.

### Duration-aware content

- Course code and time remain visible at every supported event height.
- Medium and tall events add the course title.
- Tall events add the room.
- As vertical space shrinks, hide the room first and then the title; course code and time remain.
- Text truncates cleanly without overlapping adjacent calendar cells.

The event renderer moves from inline JSX in `TimetableCalendar` to a focused `CalendarEventCard` component. It receives the event and current view or layout context and is responsible only for event content presentation.

## Event States

- **Upcoming:** normal route edge and readable foreground.
- **Finished:** slightly muted background and text while remaining readable; avoid heavy grayscale.
- **Cancelled:** muted card with course code/title struck through.
- **Absent:** red status edge or accent that remains distinct from the course route color.
- **Moodle deadline:** retains its distinct deadline treatment and does not use the standard course card hierarchy.
- **Adjusted:** retains a small, accessible adjustment indicator without displacing primary information.

## Mobile Calendar

Mobile defaults to Day view. The vertical order is:

1. Existing application header and top actions
2. Compact date navigation
3. Five-day date strip centered on the selected day
4. Compact Upcoming row or horizontal chips
5. Single-day time grid
6. Existing Calendar / Attendance / More bottom navigation

The selected date in the date strip is visually emphasized. Selecting another date navigates the calendar to that date without changing the selected semester.

Mobile event cards use the same hierarchy and transit-line treatment as desktop. Their larger single-day width allows code, time, title, and room to remain readable for normal class durations.

Selecting a mobile event opens the existing detail experience as a full-screen or bottom-sheet-style surface. Closing it returns the user to the same date and scroll position. The details surface shows time, room, lecturer, lesson type, status, and the existing course-detail action.

## Components and Data Flow

### Page

The localized calendar page continues to own:

- Raw stored events
- Selected semester
- Selected view and date
- Selected event
- Mobile Calendar / Attendance tab

It derives semester-filtered events once and passes the same list to Upcoming and `TimetableCalendar`.

### CalendarHeader

`CalendarHeader` gains the semester selector and responsive date-strip presentation. Its inputs include the current filter, available filter options, and filter-change callback. It remains responsible for navigation and view selection, not event filtering.

### UpcomingClasses

`UpcomingClasses` owns only sorting and presentation of already-filtered events. It exposes event selection through its existing callback.

### CalendarEventCard

The new component renders course events and applies duration-aware information hierarchy. Deadline rendering may stay separate within `TimetableCalendar` or use a small dedicated branch.

### TimetableCalendar

`TimetableCalendar` keeps calendar-library configuration, date navigation, status classes, localizer configuration, and event selection. It delegates course-event content to `CalendarEventCard`.

## Identity and Data Safety

No event identity logic changes. Upstream lecture IDs are fresh UUID v4 values on every request and must not be used as persistent or deduplication identities. React keys and any derived identity must continue to use stable composite event fields already available in the repository.

No server actions, API calls, database writes, or destructive operations are added by this redesign.

## Accessibility

- Toolbar controls retain visible keyboard focus states and accessible labels.
- The view selector retains pressed-state semantics.
- Date-strip buttons expose the selected date.
- Event cards maintain sufficient foreground/background contrast.
- Color is not the only status indicator; cancelled, absent, and adjusted states include shape, text, or icon differences.
- Touch targets remain at least 44 pixels where controls are used on mobile.
- Reduced-motion preferences continue to disable nonessential transitions.

## Localization

All added user-visible labels must be present in English and Traditional Chinese message files. Date formatting continues to use the active locale. Course codes, rooms, and source timetable values are displayed as supplied.

## Validation

The repository has no relevant automated UI test script. Validation therefore consists of:

- Focused ESLint on changed TypeScript and React files
- Locale JSON parsing
- Production build
- Manual checks at desktop, tablet, and mobile widths
- Manual checks for Work Week, Day, Month, and Agenda views
- Visual checks for zero, one, and three upcoming classes
- Visual checks for short and tall events
- Visual checks for upcoming, finished, cancelled, absent, adjusted, and deadline events
- Keyboard checks for toolbar, semester filter, view selector, date strip, event selection, and detail dismissal

## Acceptance Criteria

- A student can find a course code, time, and room without reading the full event title.
- Empty Upcoming content occupies only one compact row.
- The desktop week grid shows useful density without visually dominant grid lines.
- The current day and current time are immediately identifiable.
- Mobile opens in a readable Day view with direct weekday navigation.
- Event state remains understandable without relying only on color.
- All existing calendar views and event-detail actions remain functional.
- No timetable synchronization or persistence behavior changes.
