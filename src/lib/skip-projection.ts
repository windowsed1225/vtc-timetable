import type { HybridAttendanceStats } from "@/app/actions/types";
import { gracePeriodRatio, thresholdOf } from "@/lib/grace-period";

export interface SkipProjection {
	/** Passing rate this course is measured against, in percent. */
	threshold: number;
	/** Attendance rate as it stands, in percent. */
	currentRate: number;
	/** Rate the course would finish at after skipping `skip` of the remaining classes. */
	projectedRate: number;
	/** Whether the projected rate still clears the threshold. */
	isSafe: boolean;
	/** Classes that can still be skipped without dropping below the threshold. */
	safeToSkipCount: number;
	/** Of those, how many are left once `skip` is taken. */
	remainingSafeSkips: number;
	/** Classes that must be attended overall to clear the threshold. */
	requiredClasses: number;
	attendedCount: number;
	totalClasses: number;
	remainingClasses: number;
	/** Upper bound for the skip control. */
	sliderMax: number;
}

/**
 * Projected attendance for a course after skipping `skip` of its remaining
 * classes. Shared by the course-detail page and the course modal so both read
 * the same numbers from the same rules.
 */
export function skipProjection(course: HybridAttendanceStats, skip: number): SkipProjection {
	const attendedCount = course.attended || 0;
	const totalClasses = course.calendarTotalClasses || 0;
	const remainingClasses = course.calendarRemainingClasses || 0;
	const threshold = thresholdOf(course);
	const currentRate = course.minutesAttendanceRate ?? course.currentAttendanceRate ?? 0;

	const projectedAttended = attendedCount + Math.max(0, remainingClasses - skip);
	const projectedRate = totalClasses === 0 ? 0 : (projectedAttended / totalClasses) * 100;
	const safeToSkipCount = course.safeToSkipCount || 0;

	return {
		threshold,
		currentRate,
		projectedRate,
		isSafe: projectedRate >= threshold,
		safeToSkipCount,
		remainingSafeSkips: Math.max(0, safeToSkipCount - skip),
		requiredClasses: Math.ceil(totalClasses * gracePeriodRatio(threshold)),
		attendedCount,
		totalClasses,
		remainingClasses,
		// Keep the control usable even when nothing is left to skip.
		sliderMax: Math.max(remainingClasses, 5),
	};
}
