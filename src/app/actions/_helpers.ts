/**
 * Internal helpers shared across action modules.
 * Not exported from the barrel; these are implementation details.
 */

import { getSemesterLabel, type SemesterNumber } from "@/lib/semester";
import { getTimetableYearForSemester } from "@/lib/utils";

export const SEMESTER_MAP: Record<number, number[]> = {
    1: [9, 10, 11, 12],
    2: [1, 2, 3, 4],
    3: [5, 6, 7, 8],
};

export const SEMESTER_CATEGORY_MAP: Record<number, SemesterNumber> = {
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
};

export const SEMESTER_END_DATES: Record<number, { month: number; day: number }> = {
    1: { month: 12, day: 31 },
    2: { month: 5, day: 31 },
    3: { month: 8, day: 31 },
    4: { month: 12, day: 31 },
    5: { month: 5, day: 31 },
    6: { month: 8, day: 31 },
    7: { month: 12, day: 31 },
    8: { month: 5, day: 31 },
    9: { month: 8, day: 31 },
};

export const SEMESTER_ORDER_MAP: Record<string, number> = {
    "SEM 1": 1,
    "SEM 2": 2,
    "SEM 3": 3,
    "SEM 4": 4,
    "SEM 5": 5,
    "SEM 6": 6,
    "SEM 7": 7,
    "SEM 8": 8,
    "SEM 9": 9,
};

/**
 * Which (season slot, year) timetables to fetch.
 * Extra prior academic years cover HD (2y) and DVE (3y).
 */
export function getTimetableTargets(
    semesterNum: number,
    date: Date = new Date(),
    yearCount: 1 | 2 | 3 = 3,
): Array<{ semNum: number; semCategory: SemesterNumber; year: number }> {
    const currentYear = date.getFullYear();
    const prior = Math.max(0, yearCount - 1);
    const label = (n: number) => getSemesterLabel(n);
    switch (semesterNum) {
        case 1: {
            const fallYear = getTimetableYearForSemester(1, date);
            return Array.from({ length: prior + 1 }, (_, i) => ({
                semNum: 1,
                semCategory: label(1),
                year: fallYear - i,
            }));
        }
        case 2:
            return [
                { semNum: 2, semCategory: label(2), year: currentYear },
                ...Array.from({ length: prior }, (_, i) => ({
                    semNum: 2,
                    semCategory: label(2),
                    year: currentYear - 1 - i,
                })),
                { semNum: 1, semCategory: label(1), year: currentYear - 1 },
            ];
        case 3:
            return [
                { semNum: 3, semCategory: label(3), year: currentYear },
                ...Array.from({ length: prior }, (_, i) => ({
                    semNum: 3,
                    semCategory: label(3),
                    year: currentYear - 1 - i,
                })),
                { semNum: 2, semCategory: label(2), year: currentYear },
            ];
        default:
            return [];
    }
}

export type AttendancePresence = "attended" | "late" | "absent";

export function extractToken(vtcUrl: string): string | null {
    try {
        const url = new URL(vtcUrl);
        return url.searchParams.get("token");
    } catch {
        return null;
    }
}

export function getDurationInMinutes(start: Date, end: Date): number {
    return (new Date(end).getTime() - new Date(start).getTime()) / 1000 / 60;
}

export function normalizeToISODate(dateStr: string): string {
    if (!dateStr) return "";

    const pureDate = dateStr.trim().split(" ")[0];

    if (/^\d{4}-\d{2}-\d{2}/.test(pureDate)) {
        return pureDate.split("T")[0];
    }

    if (pureDate.includes("/")) {
        const [day, month, year] = pureDate.split("/");
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }

    return pureDate;
}

export function parseVtcLessonTime(
    dateStr: string,
    timeRange: string
): { start: number; end: number; duration: number; isoDate: string } | null {
    const isoDate = normalizeToISODate(dateStr);
    const [startStr, endStr] = timeRange.split("-").map((part) => part.trim());

    if (!isoDate || !startStr || !endStr) {
        return null;
    }

    const start = Math.floor(new Date(`${isoDate}T${startStr}:00+08:00`).getTime() / 1000);
    const end = Math.floor(new Date(`${isoDate}T${endStr}:00+08:00`).getTime() / 1000);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return null;
    }

    return {
        start,
        end,
        duration: (end - start) / 60,
        isoDate,
    };
}

export function buildCompositeEventId(courseCode: string, startTimestamp: number, endTimestamp: number): string {
    return `${courseCode}-${Math.floor(startTimestamp)}-${Math.floor(endTimestamp)}`;
}

export function getAttendancePresence(cls: {
    status?: number | null;
    attendTime?: string | null;
}): AttendancePresence {
    if (!cls.attendTime || cls.attendTime === "-") {
        return "absent";
    }

    if (cls.status === 3) {
        return "late";
    }

    return "attended";
}

export function isAttendanceStatusPresent(statusCode?: number | null): boolean {
    return statusCode === 1 || statusCode === 3;
}
