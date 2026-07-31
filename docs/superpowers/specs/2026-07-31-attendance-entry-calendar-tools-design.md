# Attendance Entry in Calendar Tools

## Goal

Move the existing Student Attendance Entry navigation from the desktop Attendance sidebar into the Calendar Tools popover so related utilities live in one place.

## Design

- Add a prominent link at the top of Calendar Tools that routes to `/attendance-grid`.
- Use the existing localized `attendanceGrid.navLabel` copy and a grid icon.
- Add a visual divider between the attendance link and calendar export controls.
- Remove the matching desktop Sidebar link to avoid duplicate navigation.
- Keep the attendance-entry page, mobile attendance navigation, and export behavior unchanged.

## Accessibility and responsive behavior

- Render the destination as a real link so keyboard navigation and browser link behavior work normally.
- Reuse the existing popover sizing and responsive Calendar Tools behavior.
- Give the link a clear hover and focus-visible state.

## Verification

- Test that Calendar Tools contains the localized attendance-entry link and correct route.
- Test that the desktop Sidebar no longer renders the shortcut.
- Run focused lint and the production build.
