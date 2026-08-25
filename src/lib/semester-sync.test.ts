import { describe, expect, test } from "bun:test";
import { getTimetableTargets } from "@/app/actions/_helpers";
import { getTimetableYearForSemester } from "./utils";

describe("Fall timetable year", () => {
	test("August looks ahead to this calendar year's Fall (month=9&year=2026)", () => {
		expect(getTimetableYearForSemester(1, new Date(2026, 7, 25))).toBe(2026);
	});

	test("July still belongs to last year's Fall", () => {
		expect(getTimetableYearForSemester(1, new Date(2026, 6, 31))).toBe(2025);
	});

	test("September uses the current calendar year", () => {
		expect(getTimetableYearForSemester(1, new Date(2026, 8, 1))).toBe(2026);
	});

	test("January still fetches last year's Fall", () => {
		expect(getTimetableYearForSemester(1, new Date(2026, 0, 15))).toBe(2025);
	});

	test("Spring and Summer use the current calendar year", () => {
		expect(getTimetableYearForSemester(2, new Date(2026, 7, 25))).toBe(2026);
		expect(getTimetableYearForSemester(3, new Date(2026, 7, 25))).toBe(2026);
	});
});

describe("timetable sync targets", () => {
	test("August SEM 1 lookahead fetches 2026, not 2025", () => {
		expect(getTimetableTargets(1, new Date(2026, 7, 25))).toEqual([{ semNum: 1, semCategory: "SEM 1", year: 2026 }]);
	});
});
