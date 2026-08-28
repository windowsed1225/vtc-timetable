import type { ClassRecord, HybridAttendanceStats } from "@/app/actions/types";
import { EARLY_SEMESTER_WARNING_PROGRESS, gracePeriodRatio } from "@/lib/grace-period";
import { getDurationInMinutes, isAttendanceStatusPresent } from "@/app/actions/_helpers";

export type HybridEventSource = {
	courseCode: string;
	semester?: string;
	status?: string;
	startTime: Date;
	endTime: Date;
	actualDuration?: number | null;
	attendanceStatusCode?: number | null;
};

export type HybridAttendanceSource = {
	courseCode: string;
	courseName: string;
	semester?: string;
	status?: string;
	attendRate: number;
	totalClasses: number;
	conductedClasses: number;
	attended: number;
	late: number;
	absent: number;
	isFinished: boolean;
	isFollowUp: boolean;
	baseCourseCode?: string;
	classes: Array<{
		id: string;
		date: string;
		lessonTime: string;
		attendTime: string;
		roomName: string;
		actualDuration?: number;
		status: "attended" | "late" | "absent" | string;
	}>;
};

function getClassSemester(dateStr: string): string {
	const parts = dateStr.split("/");
	const month = parseInt(parts[1], 10);
	if (month >= 9 && month <= 12) return "SEM 1";
	if (month >= 1 && month <= 4) return "SEM 2";
	return "SEM 3";
}

export function buildHybridAttendanceStats(
	records: HybridAttendanceSource[],
	events: HybridEventSource[],
	now: Date,
	threshold: number,
): HybridAttendanceStats[] {
	const ratio = gracePeriodRatio(threshold);
	const eventsByCourseCode = new Map<string, HybridEventSource[]>();
	for (const event of events) {
		const list = eventsByCourseCode.get(event.courseCode) ?? [];
		list.push(event);
		eventsByCourseCode.set(event.courseCode, list);
	}

	return records.map((record) => {
		const courseCode = record.courseCode;
		const baseCourseCode = record.baseCourseCode || courseCode;
		const calendarEvents = [
			...(eventsByCourseCode.get(courseCode) ?? []),
			...(courseCode !== baseCourseCode ? (eventsByCourseCode.get(baseCourseCode) ?? []) : []),
		];

		let calendarTotalClasses = 0;
		let calendarConductedClasses = 0;
		let calendarRemainingClasses = 0;
		let calendarTotalHours = 0;
		let calendarConductedHours = 0;
		let calendarRemainingHours = 0;
		let totalSemesterMinutes = 0;
		let totalConductedMinutes = 0;
		let totalRemainingMinutes = 0;
		let totalAttendedMinutes = 0;
		let conductedEventsWithAttendanceState = 0;

		for (const event of calendarEvents) {
			const startTime = new Date(event.startTime);
			const endTime = new Date(event.endTime);
			const durationMinutes =
				typeof event.actualDuration === "number" && event.actualDuration > 0
					? event.actualDuration
					: getDurationInMinutes(startTime, endTime);
			const durationHours = durationMinutes / 60;

			calendarTotalClasses++;
			calendarTotalHours += durationHours;
			totalSemesterMinutes += durationMinutes;

			if (endTime < now) {
				calendarConductedClasses++;
				calendarConductedHours += durationHours;
				totalConductedMinutes += durationMinutes;

				if (typeof event.attendanceStatusCode === "number" || event.status === "ABSENT") {
					conductedEventsWithAttendanceState++;
					if (isAttendanceStatusPresent(event.attendanceStatusCode)) {
						totalAttendedMinutes += durationMinutes;
					}
				}
			} else {
				calendarRemainingClasses++;
				calendarRemainingHours += durationHours;
				totalRemainingMinutes += durationMinutes;
			}
		}

		const attended = record.attended || 0;
		const attendanceRatio = calendarConductedClasses > 0 ? attended / calendarConductedClasses : 0;
		if (conductedEventsWithAttendanceState === 0) {
			totalAttendedMinutes = totalConductedMinutes * attendanceRatio;
		}

		const currentAttendanceRate = calendarConductedClasses > 0 ? (attended / calendarConductedClasses) * 100 : 0;
		const maxPossibleRate =
			calendarTotalClasses > 0 ? ((attended + calendarRemainingClasses) / calendarTotalClasses) * 100 : 0;
		const minutesAttendanceRate = totalConductedMinutes > 0 ? (totalAttendedMinutes / totalConductedMinutes) * 100 : 0;
		const maxPossibleMinutesRate =
			totalSemesterMinutes > 0 ? ((totalAttendedMinutes + totalRemainingMinutes) / totalSemesterMinutes) * 100 : 0;

		let safeToSkipCount = 0;
		if (calendarTotalClasses > 0) {
			const requiredAttendance = Math.ceil(calendarTotalClasses * ratio);
			const potentialTotal = attended + calendarRemainingClasses;
			safeToSkipCount = Math.max(0, potentialTotal - requiredAttendance);
		}

		let safeToSkipMinutes = 0;
		if (totalSemesterMinutes > 0) {
			const requiredMinutes = totalSemesterMinutes * ratio;
			const potentialMinutes = totalAttendedMinutes + totalRemainingMinutes;
			safeToSkipMinutes = Math.max(0, Math.floor(potentialMinutes - requiredMinutes));
		}

		const courseProgress = totalSemesterMinutes > 0 ? totalConductedMinutes / totalSemesterMinutes : 0;
		let recoveryStatus: HybridAttendanceStats["recoveryStatus"] = "safe";
		if (minutesAttendanceRate >= threshold) {
			recoveryStatus = "safe";
		} else if (maxPossibleMinutesRate < threshold) {
			recoveryStatus = "failed";
		} else if (courseProgress < EARLY_SEMESTER_WARNING_PROGRESS) {
			recoveryStatus = "grace";
		} else {
			recoveryStatus = "recoverable";
		}

		const classes: ClassRecord[] = record.classes.map((cls) => ({
			id: cls.id,
			date: cls.date,
			lessonTime: cls.lessonTime,
			attendTime: cls.attendTime,
			roomName: cls.roomName,
			status: cls.status as "attended" | "late" | "absent",
		}));

		let displaySemester: string | undefined;
		if (calendarEvents.length > 0) {
			const latestEvent = calendarEvents.reduce((latest, ev) => {
				return new Date(ev.startTime) > new Date(latest.startTime) ? ev : latest;
			});
			displaySemester = latestEvent.semester || undefined;
		}
		if (!displaySemester && classes.length > 0) {
			const latestClass = classes.reduce((latest, cls) => {
				const [dL, mL, yL] = latest.date.split("/").map(Number);
				const [dC, mC, yC] = cls.date.split("/").map(Number);
				return new Date(yC, mC - 1, dC) > new Date(yL, mL - 1, dL) ? cls : latest;
			});
			displaySemester = getClassSemester(latestClass.date);
		}

		const semesterBreakdowns: HybridAttendanceStats["semesterBreakdowns"] = {};
		for (const cls of classes) {
			const sem = getClassSemester(cls.date);
			if (!semesterBreakdowns[sem]) {
				semesterBreakdowns[sem] = { attended: 0, conductedClasses: 0, attendanceRate: 0, calendarTotalClasses: 0 };
			}
			semesterBreakdowns[sem].conductedClasses++;
			if (cls.status === "attended" || cls.status === "late") semesterBreakdowns[sem].attended++;
		}
		for (const event of calendarEvents) {
			const sem = event.semester;
			if (!sem) continue;
			if (!semesterBreakdowns[sem]) {
				semesterBreakdowns[sem] = { attended: 0, conductedClasses: 0, attendanceRate: 0, calendarTotalClasses: 0 };
			}
			semesterBreakdowns[sem].calendarTotalClasses++;
		}
		for (const sem of Object.keys(semesterBreakdowns)) {
			const breakdown = semesterBreakdowns[sem]!;
			breakdown.attendanceRate =
				breakdown.conductedClasses > 0 ? Math.round((breakdown.attended / breakdown.conductedClasses) * 1000) / 10 : 0;
		}

		let currentSemesterStats: HybridAttendanceStats["currentSemesterStats"];
		if (classes.length > 0) {
			const targetSem = displaySemester || record.semester;
			const currentSemClasses = classes.filter((cls) => getClassSemester(cls.date) === targetSem);
			const semConducted = currentSemClasses.length;
			const semAttended = currentSemClasses.filter((cls) => cls.status === "attended" || cls.status === "late").length;
			currentSemesterStats = {
				semester: targetSem || "SEM 2",
				attended: semAttended,
				conductedClasses: semConducted,
				attendanceRate: semConducted > 0 ? Math.round((semAttended / semConducted) * 1000) / 10 : 0,
			};
		}

		return {
			courseCode: record.courseCode,
			courseName: record.courseName,
			semester: record.semester || "SEM 2",
			status: record.status || "ACTIVE",
			attendRate: record.attendRate,
			totalClasses: record.totalClasses,
			conductedClasses: record.conductedClasses,
			attended,
			late: record.late || 0,
			absent: record.absent || 0,
			isLow: minutesAttendanceRate < threshold,
			isFinished: record.isFinished,
			isFollowUp: record.isFollowUp,
			baseCourseCode: record.baseCourseCode || courseCode,
			classes,
			gracePeriodThreshold: threshold,
			calendarTotalClasses,
			calendarConductedClasses,
			calendarRemainingClasses,
			calendarTotalHours: Math.round(calendarTotalHours * 10) / 10,
			calendarConductedHours: Math.round(calendarConductedHours * 10) / 10,
			calendarRemainingHours: Math.round(calendarRemainingHours * 10) / 10,
			totalAttendedMinutes: Math.round(totalAttendedMinutes),
			totalConductedMinutes: Math.round(totalConductedMinutes),
			totalSemesterMinutes: Math.round(totalSemesterMinutes),
			totalRemainingMinutes: Math.round(totalRemainingMinutes),
			currentAttendanceRate: Math.round(currentAttendanceRate * 10) / 10,
			maxPossibleRate: Math.round(maxPossibleRate * 10) / 10,
			minutesAttendanceRate: Math.round(minutesAttendanceRate * 10) / 10,
			maxPossibleMinutesRate: Math.round(maxPossibleMinutesRate * 10) / 10,
			safeToSkipCount,
			safeToSkipMinutes,
			recoveryStatus,
			displaySemester,
			currentSemesterStats,
			semesterBreakdowns,
		};
	});
}
