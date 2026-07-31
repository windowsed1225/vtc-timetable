# VTC Timetable Agent Guide

## Scope

These instructions apply to the repository except where a deeper `AGENTS.md` overrides them. In particular, follow `vtc-api/AGENTS.md` for work under `vtc-api/`.

VTC Timetable is a TypeScript web application for synchronizing VTC timetables and attendance, managing calendar events, and exporting or subscribing to ICS calendars.

## Product features

- VTC timetable synchronization across multiple semesters, including staged and background sync flows
- Stored and live attendance tracking with per-course statistics, manual attendance overrides, and class-hour breakdowns
- Spreadsheet-style attendance-hours grid with semester grouping and per-course detail links; this is an HTML view, not an `.xlsx` export
- Course-detail pages and modals with class counts, total and remaining hours, minutes/hours display switching, attendance status, and the skipping calculator
- Calendar event management, including status changes, actual-time corrections, course completion, and date-range deletion
- Semester `.ics` calendar downloads and Discord-linked live calendar subscription feeds; do not claim CSV or Excel export unless that functionality is implemented
- Moodle deadline retrieval
- VTC token validation, digital e-card access, programme information, and print-quota lookup
- Email/password and Discord authentication through Better Auth
- English and Traditional Chinese localization
- Responsive calendar, attendance grid, settings, and course-detail interfaces with light and dark themes

## Current stack

- Bun workspaces and a single root `bun.lock`
- Vinext/Vite with React 19
- TypeScript in strict mode
- MongoDB through Mongoose
- Better Auth
- `next-intl` with English and Traditional Chinese
- Tailwind CSS v4, shared CSS variables, and `next-themes`

Treat checked-in code, configuration, and `package.json` as authoritative. The README can lag behind migrations; do not reintroduce NextAuth or standard Next.js-only assumptions when the project currently uses Better Auth and Vinext.

## Repository layout

- `src/app/`: routes, API handlers, and server actions
- `src/app/actions/`: authentication-aware timetable, attendance, event, export, and settings operations
- `src/components/`: React UI components
- `src/lib/`: shared application utilities and service setup
- `src/models/`: Mongoose models
- `src/types/`: shared application types
- `messages/` and `i18n/`: locale messages and routing configuration
- `vtc-api/`: VTC API workspace package with its own agent instructions

## Workspace commands

- Run dependency commands from the repository root.
- Use `bun install`; do not create child lockfiles or commit `node_modules`.
- Use the scripts declared in the root `package.json`:
  - `bun run dev`
  - `bun run lint`
  - `bun run build`
  - `bun run start`
- Do not invent or claim a test command when no relevant test script exists.

## Implementation rules

- Make the smallest coherent change that satisfies the request.
- Preserve established server/client boundaries. Add `"use client"` only when browser state, effects, or event handlers require it.
- Keep database and privileged VTC operations in server actions or server routes.
- Require authentication before accessing user-owned data and scope database reads and writes to the authenticated user.
- Reuse the existing Mongoose connection and models rather than opening ad hoc connections.
- Keep shared server-action exports in `src/app/actions/index.ts` when they are part of the existing public action surface.
- Use the `@/` alias for imports within `src/`.
- Preserve strict TypeScript types; avoid `any`, unsafe assertions, and duplicated response shapes.
- When adding user-visible copy, update every supported locale instead of hard-coding one language.
- Preserve the existing design tokens and component patterns unless the task explicitly calls for a redesign.

## Timetable identity

VTC timetable lecture IDs are fresh random UUID v4 values on every upstream request. Never use them as persistent identifiers, deduplication keys, or cache keys. Use the repository's stable composite-event identity helpers and stable lecture fields instead.

## Security and data safety

- Never expose or commit authentication secrets, VTC tokens, refresh tokens, database credentials, or personal student data.
- Do not log secrets or include them in error messages.
- Validate and encode external input before placing it in URLs, database queries, or calendar output.
- Treat destructive database operations and bulk synchronization changes as high risk; preserve user ownership checks and existing recovery behavior.

## Anti-slop rules

- Reuse existing helpers, types, actions, and components before adding abstractions.
- Do not add placeholder behavior, speculative fallbacks, redundant wrappers, fake compatibility layers, or commented-out code.
- Comments should explain constraints or surprising decisions, not narrate obvious code.
- Do not silently swallow errors or convert failures into misleading success responses.
- Avoid unrelated formatting, renaming, dependency upgrades, and refactoring.
- Do not claim a lint, build, type check, or test passed unless you ran it successfully.

## Validation

- Run the narrowest relevant validation first.
- Run `bun run lint` for TypeScript or React changes covered by the repository linter.
- Run `bun run build` when changes affect routing, bundling, server/client boundaries, configuration, or production behavior.
- For database or external-API work, verify authentication, user scoping, failure handling, and secret redaction in addition to automated checks.
- Report pre-existing failures separately from failures introduced by the change.
