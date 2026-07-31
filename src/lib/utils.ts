/**
 * Extracts the token from a VTC API URL
 * @param urlString The full URL containing the token parameter
 * @returns The token string if found, null otherwise
 */
export function getTokenFromUrl(urlString: string): string | null {
    try {
        const url = new URL(urlString);
        return url.searchParams.get("token");
    } catch (error) {
        console.error("Invalid URL provided", error);
        return null;
    }
}

/**
 * Converts Unix timestamp (seconds) to a date array for ICS format
 * @param timestamp Unix timestamp in seconds
 * @returns Array of [year, month, day, hour, minute]
 */
export function getDateArray(timestamp: number): [number, number, number, number, number] {
    const date = new Date(timestamp * 1000);
    return [
        date.getFullYear(),
        date.getMonth() + 1, // ICS months are 1-indexed
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
    ];
}

/**
 * Detect current semester based on date.
 * SEM 1: September–December (returns 1)
 * SEM 2: January–April     (returns 2)
 * SEM 3: May–August         (returns 3)
 */
export function getCurrentSemester(date: Date = new Date()): number {
    const month = date.getMonth() + 1; // 1-12
    if (month >= 9 && month <= 12) return 1;
    if (month >= 1 && month <= 4) return 2;
    return 3;
}

/**
 * Get the academic year string (e.g., "2025/26").
 * Academic year starts in September.
 * Sept 2025 → "2025/26", Jan 2026 → "2025/26"
 */
export function getAcademicYear(date: Date = new Date()): string {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const startYear = month >= 9 ? year : year - 1;
    const endYear = (startYear + 1) % 100;
    return `${startYear}/${endYear.toString().padStart(2, "0")}`;
}

/**
 * Get semester label from number (e.g., 2 → "SEM 2")
 */
export function getSemesterLabel(semNum: number): "SEM 1" | "SEM 2" | "SEM 3" {
    const map: Record<number, "SEM 1" | "SEM 2" | "SEM 3"> = {
        1: "SEM 1",
        2: "SEM 2",
        3: "SEM 3",
    };
    return map[semNum] || "SEM 2";
}

/**
 * Auto-detect semester and return a human-readable label.
 * Sem 1: September–December
 * Sem 2: January–April
 * Summer: May–August
 */
export function getAutoSemester(date: Date = new Date()): "Sem 1" | "Sem 2" | "Summer" {
    const month = date.getMonth() + 1; // 1-12
    if (month >= 9 && month <= 12) return "Sem 1";
    if (month >= 1 && month <= 4) return "Sem 2";
    return "Summer";
}

/**
 * Map getAutoSemester label to semester number for API calls.
 */
export function autoSemesterToNum(label: "Sem 1" | "Sem 2" | "Summer"): number {
    const map: Record<string, number> = { "Sem 1": 1, "Sem 2": 2, "Summer": 3 };
    return map[label] ?? 2;
}

/**
 * Alias for getCurrentSemester — auto-detect semester number (1/2/3).
 */
export const getDefaultSemester = getCurrentSemester;

/**
 * Returns the list of semester numbers to sync for the current month.
 * During transition months, includes the upcoming semester so users can
 * pre-fetch the next semester's timetable before it officially starts.
 *
 * Dec      → [1, 2]  (Sem 1 active + Sem 2 lookahead)
 * Apr–May  → [2, 3]  (Sem 2 active + Sem 3 lookahead)
 * Aug      → [3, 1]  (Sem 3 active + next Sem 1 lookahead)
 * Otherwise → strict current semester only
 */
export function getSemestersToSync(): number[] {
    const month = new Date().getMonth() + 1;

    if (month === 12) return [1, 2];
    if (month >= 4 && month <= 5) return [2, 3];
    if (month === 8) return [3, 1];

    if (month >= 9 && month <= 11) return [1];
    if (month >= 1 && month <= 3) return [2];
    if (month >= 6 && month <= 7) return [3];

    // Fallback: fetch all semesters if month is unresolved
    return [1, 2, 3];
}

/**
 * Get a human-friendly semester display label with month range.
 * e.g. 1 → "Semester 1 (Sep–Dec)", 2 → "Semester 2 (Jan–Apr)", 3 → "Summer (May–Aug)"
 */
export function getSemesterDisplayLabel(semNum: number): string {
    const labels: Record<number, string> = {
        1: "Semester 1 (Sep–Dec)",
        2: "Semester 2 (Jan–Apr)",
        3: "Summer (May–Aug)",
    };
    return labels[semNum] || "Unknown";
}

export type CalendarEventDensity = "compact" | "medium" | "full";

export function getCalendarEventDensity(start: Date, end: Date): CalendarEventDensity {
    const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
    if (durationMinutes < 60) return "compact";
    if (durationMinutes < 120) return "medium";
    return "full";
}

export function getCalendarDateStrip(selectedDate: Date): Date[] {
    return [-2, -1, 0, 1, 2].map((offset) => {
        const date = new Date(selectedDate);
        date.setDate(selectedDate.getDate() + offset);
        return date;
    });
}

export function isCalendarActivationKey(key: string): boolean {
    return key === "Enter" || key === " ";
}
