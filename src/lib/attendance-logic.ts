import { AttendanceStats, ClassRecord } from "@/app/actions";
import { gracePeriodRatio, thresholdOf } from "@/lib/grace-period";

/**
 * Parses a lesson time string like "09:30 - 12:30" or "0930 - 1230"
 * returns duration in hours
 */
export function parseDuration(lessonTime: string): number {
    try {
        const parts = lessonTime.split("-").map((p) => p.trim());
        if (parts.length !== 2) return 1;

        const start = parts[0];
        const end = parts[1];

        const getMinutes = (t: string) => {
            if (t.includes(":")) {
                const [h, m] = t.split(":").map(Number);
                return h * 60 + m;
            }

            const h = parseInt(t.substring(0, t.length - 2));
            const m = parseInt(t.substring(t.length - 2));
            return h * 60 + m;
        };

        const durationMinutes = getMinutes(end) - getMinutes(start);
        return durationMinutes / 60;
    } catch (e) {
        console.error("Error parsing lesson time:", lessonTime, e);
        return 1;
    }
}

function getClassDurationHours(cls: ClassRecord): number {
    if (typeof cls.actualDuration === "number" && cls.actualDuration > 0) {
        return cls.actualDuration / 60;
    }

    return parseDuration(cls.lessonTime);
}

/**
 * Calculates attendance statistics for the skipping calculator
 */
export function calculateSkippingStats(course: AttendanceStats) {
    const totalClasses = course.totalClasses || 0;
    const conducted = course.conductedClasses || 0;
    const attendedCount = course.attended || 0;
    const threshold = thresholdOf(course);
    const ratio = gracePeriodRatio(threshold);

    const currentRate = conducted > 0 ? (attendedCount / conducted) * 100 : 100;

    const getProjectedRate = (skips: number) => {
        const futureClasses = totalClasses - conducted;
        const projectedFinalAttended = attendedCount + Math.max(0, futureClasses - skips);
        return (projectedFinalAttended / totalClasses) * 100;
    };

    const futureClasses = totalClasses - conducted;
    const requiredAttendedTotal = Math.ceil(totalClasses * ratio);
    const safetyBuffer = Math.max(0, futureClasses - Math.max(0, requiredAttendedTotal - attendedCount));

    let totalAttendedHours = 0;
    let totalRequiredHours80 = 0;
    let totalPotentialHours = 0;

    const averageDuration = course.classes.length > 0
        ? course.classes.reduce((sum, cls) => sum + getClassDurationHours(cls), 0) / course.classes.length
        : 1;

    course.classes.forEach((cls) => {
        const duration = getClassDurationHours(cls);
        if (cls.status !== "absent") {
            totalAttendedHours += duration;
        }
    });

    totalPotentialHours = totalClasses * averageDuration;
    totalRequiredHours80 = totalPotentialHours * ratio;

    return {
        currentRate,
        safetyBuffer,
        totalAttendedHours: Math.round(totalAttendedHours * 10) / 10,
        totalRequiredHours80: Math.round(totalRequiredHours80 * 10) / 10,
        getProjectedRate,
    };
}
