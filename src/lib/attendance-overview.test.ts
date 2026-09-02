import { describe, expect, test } from "bun:test";
import type { HybridAttendanceStats } from "@/app/actions";
import { buildAttendanceOverview } from "@/lib/attendance-overview";

function course(overrides: Partial<HybridAttendanceStats> = {}): HybridAttendanceStats {
	return {
		courseCode: "ITP4501",
		courseName: "Cloud Computing",
		semester: "SEM 1",
		status: "ACTIVE",
		attendRate: 75,
		totalClasses: 4,
		conductedClasses: 4,
		attended: 3,
		late: 0,
		absent: 1,
		isLow: true,
		isFinished: false,
		isFollowUp: false,
		baseCourseCode: "ITP4501",
		classes: [],
		gracePeriodThreshold: 80,
		calendarTotalClasses: 8,
		calendarConductedClasses: 4,
		calendarRemainingClasses: 4,
		calendarTotalHours: 16,
		calendarConductedHours: 8,
		calendarRemainingHours: 8,
		totalAttendedMinutes: 330,
		totalConductedMinutes: 480,
		totalSemesterMinutes: 960,
		totalRemainingMinutes: 480,
		currentAttendanceRate: 75,
		maxPossibleRate: 87.5,
		minutesAttendanceRate: 68.8,
		maxPossibleMinutesRate: 84.4,
		safeToSkipCount: 0,
		safeToSkipMinutes: 0,
		recoveryStatus: "recoverable",
		displaySemester: "SEM 1",
		semesterBreakdowns: {
			"SEM 1": {
				attended: 3,
				conductedClasses: 4,
				attendanceRate: 75,
				calendarTotalClasses: 8,
				calendarTotalHours: 16,
			},
		},
		...overrides,
	};
}

describe("buildAttendanceOverview", () => {
	test("builds selected-semester counts, hours, rates, and maximum possible attendance", () => {
		const model = buildAttendanceOverview([course()], "SEM 1");

		expect(model.activeSemester).toBe("SEM 1");
		expect(model.summary).toMatchObject({
			attended: 3,
			conducted: 4,
			absent: 1,
			total: 8,
			hours: 16,
			rate: 75,
			maxRate: 87.5,
		});
		expect(model.rows[0]).toMatchObject({ attended: 3, conducted: 4, total: 8, rate: 75 });
	});

	test("uses minute-based source values when no semester breakdown exists", () => {
		const input = course({ semesterBreakdowns: {}, minutesAttendanceRate: 68.8, maxPossibleMinutesRate: 84.4 });
		const model = buildAttendanceOverview([input], "SEM 1");

		expect(model.rows[0]?.rate).toBe(68.8);
		expect(model.rows[0]?.maxRate).toBe(84.4);
	});

	test("uses the follow-up flag instead of excluding every code ending in A", () => {
		const legitimateA = course({ courseCode: "MEDIA", baseCourseCode: "MEDIA" });
		const followUp = course({ courseCode: "ITP4501A", isFollowUp: true, baseCourseCode: "ITP4501" });

		const model = buildAttendanceOverview([legitimateA, followUp], "SEM 1");

		expect(model.rows.map((row) => row.course.courseCode)).toEqual(["MEDIA"]);
	});

	test("returns null percentages for zero classes instead of NaN", () => {
		const empty = course({
			calendarTotalClasses: 0,
			calendarConductedClasses: 0,
			calendarTotalHours: 0,
			semesterBreakdowns: {
				"SEM 1": {
					attended: 0,
					conductedClasses: 0,
					attendanceRate: 0,
					calendarTotalClasses: 0,
					calendarTotalHours: 0,
				},
			},
		});

		const model = buildAttendanceOverview([empty], "SEM 1");

		expect(model.rows[0]?.rate).toBeNull();
		expect(model.rows[0]?.maxRate).toBeNull();
		expect(model.summary.rate).toBeNull();
		expect(model.summary.maxRate).toBeNull();
	});
});
