import { describe, expect, test } from "bun:test";
import * as utils from "./utils";

type CalendarDisplayUtils = typeof utils & {
	getCalendarEventDensity?: (start: Date, end: Date) => "compact" | "medium" | "full";
	getCalendarDateStrip?: (selectedDate: Date) => Date[];
};

const calendarUtils = utils as CalendarDisplayUtils;

describe("calendar display helpers", () => {
	test("classifies event content density from duration", () => {
		expect(typeof calendarUtils.getCalendarEventDensity).toBe("function");
		const start = new Date(2026, 6, 31, 9, 0);
		expect(calendarUtils.getCalendarEventDensity?.(start, new Date(2026, 6, 31, 9, 45))).toBe("compact");
		expect(calendarUtils.getCalendarEventDensity?.(start, new Date(2026, 6, 31, 10, 30))).toBe("medium");
		expect(calendarUtils.getCalendarEventDensity?.(start, new Date(2026, 6, 31, 11, 0))).toBe("full");
	});

	test("builds a five-day strip centered on the selected date", () => {
		expect(typeof calendarUtils.getCalendarDateStrip).toBe("function");
		const dates = calendarUtils.getCalendarDateStrip?.(new Date(2026, 6, 31, 12, 0)) ?? [];
		expect(dates).toHaveLength(5);
		expect(dates.map((date) => date.getDate())).toEqual([29, 30, 31, 1, 2]);
		expect(dates[2]?.getHours()).toBe(12);
	});
});
