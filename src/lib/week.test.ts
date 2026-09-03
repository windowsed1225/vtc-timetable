import { describe, expect, test } from "bun:test";
import { academicWeekNumber, isoWeekNumber, stepCalendarDate } from "./week";

/** Midday avoids any DST edge shifting the day. */
const at = (iso: string) => new Date(`${iso}T12:00:00`);

describe("academicWeekNumber", () => {
	test("starts the academic year at September rather than ISO week 36", () => {
		expect(academicWeekNumber(at("2026-09-01"))).toBe(1);
		expect(academicWeekNumber(at("2026-09-03"))).toBe(1);
		// The same day still reads as ISO 36 for the calendar's own badge.
		expect(isoWeekNumber(at("2026-09-03"))).toBe(36);
	});

	test("counts on from there in whole weeks", () => {
		expect(academicWeekNumber(at("2026-09-07"))).toBe(2);
		expect(academicWeekNumber(at("2027-01-04"))).toBe(19);
	});

	test("keeps the week holding 1 September whole across the turnover", () => {
		// 31 Aug 2026 is the Monday of the week that contains 1 September, so it
		// belongs to week 1 rather than trailing the outgoing year.
		expect(academicWeekNumber(at("2026-08-31"))).toBe(1);
		expect(academicWeekNumber(at("2027-08-30"))).toBe(1);
	});

	test("puts the week before that at the end of the outgoing year", () => {
		expect(academicWeekNumber(at("2026-08-24"))).toBe(52);
		// Sunday closes the week just ended, matching startOfWeek.
		expect(academicWeekNumber(at("2027-08-29"))).toBe(52);
	});
});

describe("stepCalendarDate", () => {
	test("steps months from the 1st so a 31st never skips a month", () => {
		const next = stepCalendarDate(at("2026-08-31"), "month", "NEXT");
		expect(next.getFullYear()).toBe(2026);
		expect(next.getMonth()).toBe(8); // September, not October
	});

	test("steps back a month the same way", () => {
		const previous = stepCalendarDate(at("2026-03-31"), "month", "PREV");
		expect(previous.getMonth()).toBe(1); // February, not March
	});
});
