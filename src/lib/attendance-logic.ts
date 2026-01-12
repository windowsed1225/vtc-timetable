import { AttendanceStats, ClassRecord } from "@/app/actions";

/**
 * Parses a lesson time string like "09:30 - 12:30" or "0930 - 1230"
 * returns duration in hours
 */
export function parseDuration(lessonTime: string): number {
    try {
        const parts = lessonTime.split("-").map(p => p.trim());
        if (parts.length !== 2) return 1; // Fallback to 1 hour if format is weird

        const start = parts[0];
        const end = parts[1];

        // Handle both "09:30" and "0930" formats
        const getMinutes = (t: string) => {
            if (t.includes(":")) {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            } else {
                const h = parseInt(t.substring(0, t.length - 2));
                const m = parseInt(t.substring(t.length - 2));
                return h * 60 + m;
            }
        };

        const durationMinutes = getMinutes(end) - getMinutes(start);
        return durationMinutes / 60;
    } catch (e) {
        console.error("Error parsing lesson time:", lessonTime, e);
        return 1;
    }
}

/**
 * Calculates attendance statistics for the skipping calculator
 */
export function calculateSkippingStats(course: AttendanceStats) {
    const totalClasses = course.totalClasses || 0;
    const conducted = course.conductedClasses || 0;
    const attendedCount = course.attended || 0; // includes late
    const absentCount = course.absent || 0;

    // Standard Current Rate (Attended / Conducted)
    const currentRate = conducted > 0 ? (attendedCount / conducted) * 100 : 100;

    // Projected Rate if skipping X more classes
    const getProjectedRate = (skips: number) => {
        const totalProjectedAbsent = absentCount + skips;
        const totalProjectedAttended = Math.max(0, attendedCount); // Assuming future classes are not yet counted in attendedCount
        
        // This is tricky. If we skip future classes, they will be part of 'conducted' eventually.
        // The most conservative prediction: (Current Attended) / (Total Classes)
        // If I attend EVERY other future class:
        const futureClasses = totalClasses - conducted;
        const projectedFinalAttended = attendedCount + Math.max(0, futureClasses - skips);
        return (projectedFinalAttended / totalClasses) * 100;
    };

    // How many more can I skip and stay above 80%?
    // Formula: (Current Attended + (Future Classes - X)) / Total Classes >= 0.8
    // Future Classes - X >= 0.8 * Total Classes - Current Attended
    // X <= Future Classes - (0.8 * Total Classes - Current Attended)
    const futureClasses = totalClasses - conducted;
    const requiredAttendedTotal = Math.ceil(totalClasses * 0.8);
    const safetyBuffer = Math.max(0, futureClasses - Math.max(0, requiredAttendedTotal - attendedCount));

    // Hour calculations
    let totalAttendedHours = 0;
    let totalRequiredHours80 = 0;
    let totalPotentialHours = 0;

    // We need to estimate duration if missing. Use average duration of conducted classes.
    const averageDuration = course.classes.length > 0
        ? course.classes.reduce((sum, c) => sum + parseDuration(c.lessonTime), 0) / course.classes.length
        : 1;

    course.classes.forEach(cls => {
        const duration = parseDuration(cls.lessonTime);
        if (cls.status !== "absent") {
            totalAttendedHours += duration;
        }
    });

    totalPotentialHours = totalClasses * averageDuration;
    totalRequiredHours80 = totalPotentialHours * 0.8;

    return {
        currentRate,
        safetyBuffer,
        totalAttendedHours: Math.round(totalAttendedHours * 10) / 10,
        totalRequiredHours80: Math.round(totalRequiredHours80 * 10) / 10,
        getProjectedRate
    };
}
