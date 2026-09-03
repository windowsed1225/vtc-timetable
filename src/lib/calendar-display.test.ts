import { describe, expect, test } from "bun:test";
import * as utils from "./utils";

type CalendarDisplayUtils = typeof utils & {
	getCalendarEventDensity?: (start: Date, end: Date) => "compact" | "medium" | "full";
	isCalendarActivationKey?: (key: string) => boolean;
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

	test("accepts keyboard keys that activate calendar events", () => {
		expect(typeof calendarUtils.isCalendarActivationKey).toBe("function");
		expect(calendarUtils.isCalendarActivationKey?.("Enter")).toBe(true);
		expect(calendarUtils.isCalendarActivationKey?.(" ")).toBe(true);
		expect(calendarUtils.isCalendarActivationKey?.("ArrowDown")).toBe(false);
	});
});
