// Manual attendance tracking utilities for courses without API data

export interface ManualAttendanceMark {
    status: "attended" | "late" | "absent";
    timestamp: number;
}

export interface ManualAttendanceData {
    [eventId: string]: ManualAttendanceMark;
}

const getStorageKey = (courseCode: string) => `manual-attendance-${courseCode}`;

/**
 * Load manual attendance marks for a course from localStorage
 */
export function loadManualAttendance(courseCode: string): ManualAttendanceData {
    if (typeof window === "undefined") return {};

    try {
        const key = getStorageKey(courseCode);
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : {};
    } catch (error) {
        console.error("Error loading manual attendance:", error);
        return {};
    }
}

/**
 * Save a manual attendance mark for a specific event
 */
export function saveManualAttendanceMark(
    courseCode: string,
    eventId: string,
    status: "attended" | "late" | "absent"
): void {
    if (typeof window === "undefined") return;

    try {
        const existing = loadManualAttendance(courseCode);
        existing[eventId] = {
            status,
            timestamp: Date.now(),
        };

        const key = getStorageKey(courseCode);
        localStorage.setItem(key, JSON.stringify(existing));

        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent("manual-attendance-updated", {
            detail: { courseCode, eventId, status },
        }));
    } catch (error) {
        console.error("Error saving manual attendance:", error);
    }
}

/**
 * Get manual attendance mark for a specific event
 */
export function getManualAttendanceMark(
    courseCode: string,
    eventId: string
): "attended" | "late" | "absent" | null {
    const data = loadManualAttendance(courseCode);
    return data[eventId]?.status || null;
}

/**
 * Calculate attendance stats from manual marks
 */
export function calculateManualStats(courseCode: string, totalClasses: number) {
    const marks = loadManualAttendance(courseCode);
    const entries = Object.values(marks);

    let attended = 0;
    let late = 0;
    let absent = 0;

    entries.forEach(mark => {
        if (mark.status === "attended") attended++;
        else if (mark.status === "late") {
            attended++; // Late counts as attended
            late++;
        }
        else if (mark.status === "absent") absent++;
    });

    const attendRate = totalClasses > 0 ? (attended / totalClasses) * 100 : 0;

    return { attended, late, absent, attendRate };
}

/**
 * Clear all manual attendance for a course
 */
export function clearManualAttendance(courseCode: string): void {
    if (typeof window === "undefined") return;

    try {
        const key = getStorageKey(courseCode);
        localStorage.removeItem(key);
        window.dispatchEvent(new CustomEvent("manual-attendance-updated", {
            detail: { courseCode, cleared: true },
        }));
    } catch (error) {
        console.error("Error clearing manual attendance:", error);
    }
}
