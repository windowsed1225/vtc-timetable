import { describe, expect, test } from "bun:test";
import {
	detectProgrammeKind,
	normalizeSemester,
	parseIntakeAcademicYear,
	parseStudyYear,
	programmeSemesterFromDate,
	programmeSemesterFromVtcDate,
	programmeYearCount,
	resolveProgrammeStartAcademicYear,
	studyYearFromStudentId,
} from "./semester";

describe("programme name / prefix", () => {
	test("Higher Diploma in Software Engineering is HD (2 years, 1–5)", () => {
		expect(detectProgrammeKind("Higher Diploma in Software Engineering")).toBe("hd");
		expect(programmeYearCount("hd")).toBe(2);
	});

	test("Diploma of Foundation Studies is DFS (1 year, 1–3)", () => {
		expect(detectProgrammeKind("Diploma of Foundation Studies")).toBe("dfs");
		expect(detectProgrammeKind("基礎課程文憑")).toBe("dfs");
		expect(programmeYearCount("dfs")).toBe(1);
	});

	test("Youth College DVE is 3 years (1–9)", () => {
		expect(detectProgrammeKind("Diploma of Vocational Education (Business)")).toBe("dve");
		expect(detectProgrammeKind("Youth College", "DVE")).toBe("dve");
		expect(detectProgrammeKind("職專文憑")).toBe("dve");
		expect(programmeYearCount("dve")).toBe(3);
	});
});

describe("student ID intake year", () => {
	test("25xxxxxxx is 2025 intake (year 1 in 2025/26, year 2 from Sep 2026)", () => {
		expect(parseIntakeAcademicYear("250083235")).toBe(2025);
		expect(studyYearFromStudentId("250083235", new Date(2025, 8, 1))).toBe(1);
		expect(studyYearFromStudentId("250083235", new Date(2026, 7, 28))).toBe(1);
		expect(studyYearFromStudentId("250083235", new Date(2026, 8, 1))).toBe(2);
	});

	test("26xxxxxxx Fall 2026 is year 1 semester 1", () => {
		expect(parseIntakeAcademicYear("260123456")).toBe(2026);
		const start = resolveProgrammeStartAcademicYear({ intakeYear: 2026, kind: "hd" });
		expect(start).toBe(2026);
		expect(programmeSemesterFromDate(new Date(2026, 8, 1), start, "hd")).toBe(1);
	});
});

describe("semester numbers", () => {
	test("normalizes SEM labels and raw numbers", () => {
		expect(normalizeSemester("SEM 1")).toBe(1);
		expect(normalizeSemester(4)).toBe(4);
		expect(normalizeSemester("9")).toBe(9);
		expect(normalizeSemester("SEM 10")).toBeNull();
	});
});

describe("DFS mapping", () => {
	test("one academic year is 1–3", () => {
		expect(programmeSemesterFromDate(new Date(2025, 8, 1), 2025, "dfs")).toBe(1);
		expect(programmeSemesterFromDate(new Date(2026, 0, 15), 2025, "dfs")).toBe(2);
		expect(programmeSemesterFromDate(new Date(2026, 5, 1), 2025, "dfs")).toBe(3);
	});
});

describe("HD mapping", () => {
	test("year 2 is 4 (Fall) and 5 (Spring)", () => {
		const start = 2024;
		expect(programmeSemesterFromDate(new Date(2024, 8, 2), start, "hd")).toBe(1);
		expect(programmeSemesterFromDate(new Date(2025, 1, 10), start, "hd")).toBe(2);
		expect(programmeSemesterFromDate(new Date(2025, 6, 1), start, "hd")).toBe(3);
		expect(programmeSemesterFromDate(new Date(2025, 8, 1), start, "hd")).toBe(4);
		expect(programmeSemesterFromDate(new Date(2026, 2, 1), start, "hd")).toBe(5);
	});

	test("Year 1 HD in August still tags next Fall as semester 1", () => {
		const now = new Date(2026, 7, 28);
		const fall = new Date(2026, 8, 1);
		const start = resolveProgrammeStartAcademicYear({
			now,
			studyYear: 1,
			kind: "hd",
			earliestDate: fall,
			latestDate: fall,
		});
		expect(start).toBe(2026);
		expect(programmeSemesterFromDate(fall, start, "hd")).toBe(1);
	});
});

describe("DVE mapping", () => {
	test("three years map to 1–9", () => {
		const start = 2023;
		expect(programmeSemesterFromDate(new Date(2023, 8, 1), start, "dve")).toBe(1);
		expect(programmeSemesterFromDate(new Date(2024, 8, 1), start, "dve")).toBe(4);
		expect(programmeSemesterFromDate(new Date(2025, 1, 1), start, "dve")).toBe(5);
		expect(programmeSemesterFromDate(new Date(2025, 6, 1), start, "dve")).toBe(6);
		expect(programmeSemesterFromDate(new Date(2025, 8, 1), start, "dve")).toBe(7);
		expect(programmeSemesterFromDate(new Date(2026, 3, 1), start, "dve")).toBe(8);
	});

	test("study year 3 with only current-year classes shifts start back two years", () => {
		const now = new Date(2026, 0, 20);
		expect(parseStudyYear("3")).toBe(3);
		const start = resolveProgrammeStartAcademicYear({
			now,
			studyYear: 3,
			kind: "dve",
			earliestDate: new Date(2025, 8, 15),
			latestDate: new Date(2025, 8, 15),
		});
		expect(start).toBe(2023);
		expect(programmeSemesterFromVtcDate("15/09/2025", start, "dve")).toBe(7);
	});
});
