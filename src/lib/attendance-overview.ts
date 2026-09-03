import type { HybridAttendanceStats } from "@/app/actions";
import { DEFAULT_GRACE_PERIOD_THRESHOLD, thresholdOf } from "@/lib/grace-period";
import { SEMESTER_ORDER } from "@/lib/semester";

export type AttendanceTone = "success" | "warning" | "error";

export interface AttendanceOverviewRow {
	course: HybridAttendanceStats;
	attended: number;
	conducted: number;
	total: number;
	absences: number;
	hours: number;
	rate: number | null;
	maxRate: number | null;
	tone: AttendanceTone;
	threshold: number;
}

export interface AttendanceOverviewSummary {
	attended: number;
	conducted: number;
	total: number;
	absent: number;
	hours: number;
	rate: number | null;
	maxRate: number | null;
	threshold: number;
	tone: AttendanceTone;
}

export interface AttendanceOverviewModel {
	semesters: string[];
	activeSemester: string | null;
	rows: AttendanceOverviewRow[];
	summary: AttendanceOverviewSummary;
}

function safeRate(numerator: number, denominator: number): number | null {
	if (denominator <= 0) return null;
	return (numerator / denominator) * 100;
}

function toneFor(rate: number | null, threshold: number): AttendanceTone {
	if (rate === null || rate >= 90) return "success";
	if (rate < threshold) return "error";
	return "warning";
}

export function buildAttendanceOverview(
	stats: HybridAttendanceStats[],
	requestedSemester?: string | null,
): AttendanceOverviewModel {
	const tracked = stats.filter((course) => !course.isFollowUp);
	const semesterSet = new Set<string>();

	for (const course of tracked) {
		semesterSet.add(course.displaySemester || course.semester || "SEM 2");
		for (const key of Object.keys(course.semesterBreakdowns ?? {})) semesterSet.add(key);
	}

	// Listed oldest first so the picker reads SEM 1 → SEM n; the default below
	// still lands on the most recent active semester.
	const semesters = [...semesterSet].sort(
		(a, b) => (SEMESTER_ORDER[a] || 0) - (SEMESTER_ORDER[b] || 0),
	);
	const activeSemester =
		(requestedSemester && semesters.includes(requestedSemester) ? requestedSemester : null) ??
		semesters.toReversed().find((semester) =>
			tracked.some(
				(course) =>
					course.status === "ACTIVE" &&
					(Boolean(course.semesterBreakdowns?.[semester]) ||
						(course.displaySemester || course.semester) === semester),
			),
		) ??
		semesters[semesters.length - 1] ??
		null;

	const rows: AttendanceOverviewRow[] = activeSemester
		? tracked
				.filter(
					(course) =>
						Boolean(course.semesterBreakdowns?.[activeSemester]) ||
						(course.displaySemester || course.semester) === activeSemester,
				)
				.map((course) => {
					const breakdown = course.semesterBreakdowns?.[activeSemester];
					const attended = breakdown?.attended ?? course.attended ?? 0;
					const conducted = breakdown?.conductedClasses ?? course.calendarConductedClasses ?? 0;
					const total = breakdown?.calendarTotalClasses ?? course.calendarTotalClasses ?? 0;
					const remaining = Math.max(0, total - conducted);
					const threshold = thresholdOf(course);
					const breakdownCount = Object.keys(course.semesterBreakdowns ?? {}).length;
					const hours =
						breakdown?.calendarTotalHours ??
						(breakdownCount <= 1 ? course.calendarTotalHours ?? 0 : 0);
					const rate = breakdown
						? safeRate(attended, conducted)
						: conducted > 0
							? course.minutesAttendanceRate
							: null;
					const maxRate = breakdown
						? safeRate(attended + remaining, total)
						: total > 0
							? course.maxPossibleMinutesRate
							: null;

					return {
						course,
						attended,
						conducted,
						total,
						absences: Math.max(0, conducted - attended),
						hours,
						rate,
						maxRate,
						tone: toneFor(rate, threshold),
						threshold,
					};
				})
		: [];

	let attended = 0;
	let conducted = 0;
	let total = 0;
	let hours = 0;
	for (const row of rows) {
		attended += row.attended;
		conducted += row.conducted;
		total += row.total;
		hours += row.hours;
	}
	const threshold = rows[0]?.threshold ?? DEFAULT_GRACE_PERIOD_THRESHOLD;
	const rate = safeRate(attended, conducted);
	const maxRate = safeRate(attended + Math.max(0, total - conducted), total);

	return {
		semesters,
		activeSemester,
		rows,
		summary: {
			attended,
			conducted,
			total,
			absent: Math.max(0, conducted - attended),
			hours,
			rate,
			maxRate,
			threshold,
			tone: toneFor(rate, threshold),
		},
	};
}
