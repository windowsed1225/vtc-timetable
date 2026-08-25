# Subscription in Calendar Tools

## Goal

Move the existing Subscribe to Calendar action from the desktop Sidebar into the Top Navbar's Calendar Tools popover so calendar utilities are grouped together without crowding the navbar.

## Layout

Calendar Tools will contain, in order:

1. Student Attendance Entry
2. Subscribe to Calendar
3. Semester selection and `.ics` calendar export

The subscription action will be visually separated from export controls while remaining part of the same popover.

## Component and data flow

- `page.tsx` passes the signed-in user's Discord ID to `CalendarTopActions`.
- `CalendarTopActions` renders `SubscribeButton` only when a Discord ID exists.
- `SubscribeButton` keeps its existing behavior: build the `/api/calendar/{discordId}` feed URL, copy it, and show calendar-app setup instructions.
- `Sidebar` removes its `SubscribeButton` import and rendered subscription action.
- The calendar subscription API route and feed security model remain unchanged.

## Responsive and accessibility behavior

- The action remains available on mobile through the existing Calendar Tools popover.
- The popover control uses a minimum 44px touch target and visible hover/focus states.
- Existing modal dismissal and clipboard fallback behavior remain unchanged.
- No duplicate subscription shortcut remains in the Sidebar.

## Verification

- Add a regression test proving the subscription action is owned by Calendar Tools and absent from Sidebar.
- Verify the signed-in Discord ID is passed into `CalendarTopActions`.
- Run focused tests, focused lint, and a production build.
