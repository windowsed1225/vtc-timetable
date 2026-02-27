# VTC Timetable Website - AI Coding Agent Guide

## Project Overview

Next.js 16 (App Router) application for VTC (Vocational Training Council) students to view their timetables, track attendance, and export calendars. Uses Discord OAuth for authentication and MongoDB for persistence.

## Architecture & Data Flow

### Core Data Flow: VTC API → MongoDB → UI

```
VTC Mobile API (via vtc-api/ submodule)
  → Server Actions (src/app/actions.ts)
  → MongoDB Models (Event, Attendance, User)
  → Client Components (React Big Calendar UI)
```

**Key Point**: Events and attendance are synced from VTC's mobile API and persisted in MongoDB. The UI displays stored data, NOT live API data.

### Authentication Pattern

- **Dual OAuth Strategy** via NextAuth v5 (Beta) - see [src/auth.ts](../src/auth.ts)
     - **Discord OAuth** - Primary authentication method
     - **Credentials Provider** - Email/password login with bcrypt hashing
- `discordId` is the primary user identifier throughout the system
- JWT tokens store `discordId` as `token.sub`
- User model supports multiple auth providers via `authProvider: string[]` array

### Database Schema (MongoDB + Mongoose)

Three core models in `src/models/`:

1. **Event** - Individual class sessions

      - Foreign key: `vtcStudentId` (indexed)
      - Unique compound index: `(vtc_id, vtcStudentId, semester)` - prevents duplicates
      - Fields: `semester`, `status`, `courseCode`, `startTime`, `endTime`, `location`, `colorIndex`
      - Status enum: `UPCOMING | FINISHED | CANCELED | RESCHEDULED | ABSENT`
      - **vtc_id generation**: Composite ID from `courseCode-weekNum-startTime-endTime` (deterministic)

2. **Attendance** - Per-course attendance statistics

      - Tracks: `attendRate`, `totalClasses`, `conductedClasses`, `attended`, `late`, `absent`
      - Contains `classes[]` array with individual class records (date, lessonTime, status)
      - Status enum: `ACTIVE | FINISHED`

3. **User** - Discord account mapping
      - Links `discordId` to `vtcStudentId`
      - Stores VTC API token (encrypted) and last sync timestamp

**Connection Pattern**: Always use the cached connection from `lib/db.ts` - never create new connections. MongoDB connection is cached globally to survive Next.js hot reloads.

## Critical Developer Workflows

### Running the Application

```bash
npm run dev          # Development server (http://localhost:3000)
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
```

**Environment Variables** (`.env.local`):

- `MONGODB_URI` - MongoDB connection string (required but currently commented out in db.ts)
- `AUTH_SECRET` - NextAuth secret for JWT signing
- `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` - Discord OAuth credentials

### Syncing VTC Data

The sync flow in `src/app/actions.ts` (`syncVtcData` function):

1. Extract VTC API token from URL (`mobile.vtc.edu.hk`)
2. Fetch all months for specified semester (see `SEMESTER_MAP`)
3. **"Check then insert"** logic - Query existing events, filter batch, use `insertMany({ ordered: false })`
      - Never updates existing events - only inserts new ones
      - Uses `insertMany()` for bulk efficiency, not `updateOne()` loops
      - `ordered: false` continues inserting even if duplicates occur (race condition handling)
4. Fetch attendance data with `bulkWrite()` for upserts

**Semester Backfill Logic** (prevents missing past events):

- Fall (SEM 1): Fetch Fall only
- Spring (SEM 2): Fetch Spring (current year) + Fall (previous year)
- Summer (SEM 3): Fetch Summer + Spring (current year)

**Background Sync**: [BackgroundSync.tsx](../src/components/BackgroundSync.tsx) auto-syncs every 24h when user is logged in. Uses `checkAndSyncBackground()` server action.

### Semester System

```typescript
SEMESTER_MAP = {
  1: [9, 10, 11, 12],  // Sept-Dec
  2: [1, 2, 3, 4],     // Jan-Apr
  3: [5, 6, 7, 8]      // May-Aug (Summer)
}
```

**Important**: As of February 2026, the current date is in Semester 2. When fetching data, loop through the semester's months and aggregate results.

## Project-Specific Conventions

### Server Actions Pattern

All data operations are Server Actions in `src/app/actions.ts` marked with `"use server"`. Never use client-side API routes for database operations.

Key server actions:

- `syncVtcData(vtcUrl, semesterNum)` - Main sync entry point (uses token + semester)
- `autoSyncFromStoredToken()` - Auto-sync using stored token (no user input needed)
- `getStoredEvents()` - Fetch events for current user (uses `vtcStudentId` from User)
- `getHybridAttendanceStats()` - Merge VTC API + manual attendance + calendar totals
- `toggleEventAttendance(vtc_id, status)` - Toggle ABSENT/UPCOMING status
- `refreshAttendance()` - Re-fetch from VTC API using stored token

### Hybrid Attendance System

**Critical Pattern**: Courses have THREE data sources merged into `HybridAttendanceStats`:

1. **VTC API Attendance** - Official conducted/attended counts from `Attendance` model
2. **Calendar Events** - Total scheduled classes (past + future) from `Event` model
3. **Manual Attendance** - User overrides via `toggleEventAttendance()` (stored in Event.status)

The `getHybridAttendanceStats()` function:

- Uses **minute-based calculations** for accuracy (not just class counts)
- Calculates `currentAttendanceRate` (conducted only) vs `maxPossibleRate` (if attend all future)
- Includes `safeToSkipMinutes` - how many minutes can be skipped while staying ≥80%
- Recovery status: `"safe" | "recoverable" | "failed" | "grace"` (grace = early semester)

### Color Assignment

Course colors are **deterministic** - generated from course code hash via `getColorIndex()` in `lib/colors.ts`. Uses 10 pastel colors. Never assign colors randomly.

### Calendar Export (WebCal)

API Route: `/api/calendar/[discordId]`

**Security Note**: Intentionally unauthenticated - calendar apps can't do OAuth. The `discordId` acts as a secret token. Anyone with the URL can access the user's events (standard WebCal trade-off).

Example: `webcal://localhost:3000/api/calendar/{discordId}?semester=SEM+2`

### Date Handling

- VTC API returns dates as `DD/MM/YYYY` strings
- Always normalize with `normalizeToISODate()` to `YYYY-MM-DD` before storage
- Timestamps in VTC API are Unix seconds (not milliseconds)
- Use `dayjs` for date manipulation (already installed)

## Integration Points

### VTC API (vtc-api/ subdirectory)

TypeScript API client in `vtc-api/src/core/api.ts`:

- `getTimeTableAndReminderList(month, year)` - Fetch timetable events
- `getClassAttendanceList()` - Fetch all course attendance
- `getClassAttendanceDetail(courseCode)` - Detailed class-by-class attendance
- `checkAccessToken()` - Validate VTC token

**Base URL**: `https://mobile.vtc.edu.hk/api?cmd={command}&token={token}`

All endpoints return: `{ isSuccess, errorCode, errorMsg, payload }`

### React Big Calendar

UI component: [TimetableCalendar.tsx](../src/components/TimetableCalendar.tsx)

- View modes: Month, Week, Work Week, Day, Agenda
- Custom event styling based on `colorIndex` and `status`
- Double-click opens [EventDetailsModal.tsx](../src/components/EventDetailsModal.tsx)

### ICS Export

Button component: [ExportSemesterButton.tsx](../src/components/ExportSemesterButton.tsx)

Uses `ics` library to generate `.ics` files from stored events. Downloads directly to browser.

## Common Pitfalls

1. **Don't create new MongoDB connections** - Always use `connectDB()` from `lib/db.ts`
2. **Semester filtering** - Always check which semester events belong to (stored in `Event.semester` field)
3. **Manual vs API attendance** - Use `getHybridAttendanceStats()`, not raw `Attendance` model
4. **NextAuth v5 beta** - Uses new `auth()` function instead of `getServerSession()`
5. **Date formats** - VTC API uses `DD/MM/YYYY`, always normalize to ISO format
6. **Token extraction** - Extract from URL search params, not path
7. **Bulk inserts** - Use `insertMany()` with `ordered: false`, not loops with `findOneAndUpdate()`
8. **Foreign keys** - Query by `vtcStudentId`, not `discordId` (use User model to map)

## Key Files Reference

- [src/app/actions.ts](../src/app/actions.ts) - All server actions (1658 lines, most important file)
- [src/auth.ts](../src/auth.ts) - NextAuth configuration with Discord provider
- [src/lib/attendance-logic.ts](../src/lib/attendance-logic.ts) - Skipping calculator, duration parsing
- [src/models/](../src/models/) - Mongoose schemas (Event, Attendance, User)
- [vtc-api/src/core/api.ts](../vtc-api/src/core/api.ts) - VTC API client wrapper
