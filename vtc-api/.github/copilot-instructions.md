# Moodle Timetable to ICS Converter

## Project Overview

Converts VTC (Vocational Training Council) Moodle timetable data from their mobile API into standard `.ics` calendar files for import into calendar applications (Google Calendar, Outlook, etc.).

## Architecture

### Dual Implementation Strategy

The codebase maintains **two parallel implementations**:

1. **TypeScript (Modern, `src/`)** - Class-based, typed, modular
2. **JavaScript (Legacy, root)** - Script-based, simple, single-file

### TypeScript Structure (`src/`)

```
src/
├── core/
│   ├── api.ts        # API client with 4 typed endpoints
│   ├── ics.ts        # ICS file generator (Icsgenerator class)
│   └── utils.ts      # Semester utilities (semster_timetable function)
├── types/
│   ├── combined.ts   # Event data interface
│   └── *.ts          # API response type definitions
└── index.ts          # Main entry point
```

### Data Flow

```
VTC API
  → API.getTimeTableAndReminderList(month, year)
  → data/timetable_YYYY_M.json (individual months)
  → data/semester_N_combined.json (merged)
  → Icsgenerator.generateIcsFiles()
  → semester_N_classes.ics
```

## VTC API Integration

### Base URL

`https://mobile.vtc.edu.hk/api?cmd={command}&token={token}&...`

### Available Endpoints (src/core/api.ts)

1. **`getTimeTableAndReminderList(month: number, year: number)`**

      - Main timetable endpoint
      - Returns schedule, exams, holidays, personal reminders
      - Structure: `payload.timetable.add[]` array of events

2. **`getMoodleTimetable(isPlural: number, month: number, year: number)`**

      - Alternative Moodle-specific timetable format
      - `isPlural=1` for multiple entries

3. **`getClassAttendanceList()`**

      - Student's enrolled courses with attendance rates
      - Returns: `payload.courses[]` with `attendRate` and `passRate`

4. **`getClassAttendanceDetail(courseCode: string)`**
      - Per-course attendance breakdown

### API Response Pattern

All endpoints return:

```json
{
  isSuccess: boolean,
  errorCode: number,
  errorMsg: null | string,
  payload: { /* endpoint-specific data */ }
}
```

### Event Object Structure

```json
{
  id: string,                    // UUID
  courseCode: "ITE3707",
  courseTitle: "Foundation Mathematics II (B)",
  lessonType: "Tutorial (T)" | "Lecture (L)" | "Workshop (WS)",
  campusCode: "KT",
  roomNum: "KT-KT-144B",
  weekNum: "19",
  lecturerName: "CHAN NGA WUN",
  startTime: 1767922200,         // Unix timestamp (seconds)
  endTime: 1767925800
}
```

## Running the Application

### TypeScript (Recommended)

```bash
# Install dependencies
npm install

# Run with Bun (fastest)
bun run src/index.ts

# Or with tsx
npx tsx src/index.ts

# Or with ts-node
npx ts-node src/index.ts
```

**Output**: `semester_2_classes.ics`

### Legacy JavaScript

```bash
# 1. Fetch data for months 1-4
node request.js

# 2. Generate ICS from data/ folder
node parser.js
```

**Output**: `my_schedule.ics`

## Critical Code Patterns

### 1. Semester System (src/core/utils.ts)

VTC operates on 3 semesters per year:

```typescript
const SEMESTER_MAP = {
  1: [9, 10, 11, 12],  // Fall: Sep-Dec
  2: [1, 2, 3, 4],     // Spring: Jan-Apr
  3: [5, 6, 7, 8]      // Summer: May-Aug
}
```

**Year Calculation Logic**:

- Semester 1 (fall) uses `currentYear - 1` because academic year 2025-2026 has fall 2025
- Semesters 2 & 3 use `currentYear`

```typescript
let effectiveYear = currentYear;
if (semesterNum === 1 && [9, 10, 11, 12].includes(month)) {
    effectiveYear = currentYear - 1;
}
```

### 2. Event Transformation

**TypeScript** (src/core/ics.ts):

```typescript
{
  title: `${item.courseCode} - ${item.courseCode}`,  // ⚠️ BUG: duplicates code
  start: convertTimestampToICSDate(item.startTime),
  duration: calculateDuration(item.startTime, item.endTime),
  location: item.roomNum,
  description: `Instructor: ${item.lecturerName}\nRoom: ${item.roomNum}\nTime: ${...}`,
  status: 'CONFIRMED',
  categories: ['Class']
}
```

**JavaScript** (parser.js):

```javascript
{
  title: `${item.courseTitle} (${item.courseCode})`,  // ✓ Includes full title
  // ... rest similar
}
```

### 3. Timestamp Conversion

Unix timestamp (seconds) → ICS date array:

```typescript
convertTimestampToICSDate(timestamp: number): [number, number, number, number, number] {
    const date = new Date(timestamp * 1000);  // Convert to milliseconds
    return [
        date.getFullYear(),
        date.getMonth() + 1,    // ICS months are 1-indexed
        date.getDate(),
        date.getHours(),
        date.getMinutes()
    ];
}
```

### 4. Duration Calculation

```typescript
calculateDuration(start: number, end: number) {
    const diff = end - start;           // Difference in seconds
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    return { hours, minutes };
}
```

## File Structure Conventions

### Data Directory (`data/`)

- `timetable_YYYY_M.json` - Individual month responses from API
- `semester_N_combined.json` - Merged events for entire semester (flat array)
- `class_attendance_list.json` - Attendance data (if fetched)

### Output Files

- **TypeScript**: `semester_N_classes.ics` (where N = 1, 2, or 3)
- **JavaScript**: `my_schedule.ics`

## Type System

All API responses have generated TypeScript interfaces in `src/types/`:

- `getTimeTableAndReminderList.ts` - Includes nested `Payload`, `Exam`, `Add` interfaces
- `combinedData.ts` - Simplified event structure for ICS generation
- `getClassAttendanceList.ts` - Attendance API response
- `getClassAttendanceDetail.ts` - Detailed attendance
- `getMoodleTimetable.ts` - Alternative timetable format

## Known Issues & TODOs

1. **Title Bug**: [src/core/ics.ts line 24](../src/core/ics.ts#L24) duplicates `courseCode` instead of using `courseTitle`

      ```typescript
      // Current (wrong):
      title: `${item.courseCode} - ${item.courseCode}`

      // Should be:
      title: `${item.courseTitle} (${item.courseCode})`
      ```

2. **Token Hardcoding**: Token is hardcoded in [src/index.ts line 5](../src/index.ts#L5) and [request.js line 1](../request.js#L1)

      - Consider environment variable: `process.env.VTC_API_TOKEN`

3. **Manual Data Movement**: Legacy workflow requires manually moving JSON files from root to `data/` folder

4. **Year Hardcoding**: Current year is inferred from `new Date().getFullYear()` but may need manual adjustment for historical data

## Dependencies

```json
{
  "ics": "^3.8.1"  // Only production dependency
}
```

**Runtime Requirements**:

- Node.js 18+ (for native `fetch` API)
- TypeScript (dev dependency, implicit)
- Bun (optional, faster execution)

## Common Development Tasks

### Adding a New API Endpoint

1. Define TypeScript interface in `src/types/newEndpoint.ts`
2. Add method to [src/core/api.ts](../src/core/api.ts) following existing pattern
3. Update [src/index.ts](../src/index.ts) to use new endpoint

### Changing Event Title Format

Modify line 24 in [src/core/ics.ts](../src/core/ics.ts#L24)

### Fetching Different Semester

Change semester number in [src/index.ts](../src/index.ts) or call:

```typescript
await semster_timetable(client, 1);  // For fall semester
```

### Custom Date Range

Use `API.getTimeTableAndReminderList(month, year)` directly with specific months instead of semester utility.

## Testing

⚠️ **No formal test suite** - test manually:

1. Run `bun run src/index.ts`
2. Verify `semester_2_classes.ics` is created
3. Import into calendar app to validate format
4. Check for missing/duplicated events

## Authentication

The VTC API token appears to be a **persistent UUID** tied to a user account. Token rotation/expiration behavior is unknown. Monitor for `errorCode` in API responses to detect authentication failures.
