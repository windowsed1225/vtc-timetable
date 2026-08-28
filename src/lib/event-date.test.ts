import { describe, expect, test } from "bun:test";
import { formatClassDate, formatCompactClassDate, toValidDate } from "./event-date";

describe("class date formatting", () => {
	test("formats a Hong Kong morning date in English and zh-HK", () => {
		const start = new Date("2026-08-28T01:30:00.000Z");
		expect(formatClassDate(start, "en")).toBe("Friday, August 28, 2026");
		expect(formatClassDate(start, "zh-HK")).toBe("2026年8月28日星期五");
	});

	test("does not shift the calendar date around midnight in Hong Kong", () => {
		const justAfterMidnight = new Date("2026-08-27T16:30:00.000Z");
		expect(formatClassDate(justAfterMidnight, "en")).toBe("Friday, August 28, 2026");
		const justBeforeMidnight = new Date("2026-08-27T15:59:00.000Z");
		expect(formatClassDate(justBeforeMidnight, "en")).toBe("Thursday, August 27, 2026");
	});

	test("returns null for invalid dates", () => {
		expect(toValidDate("not-a-date")).toBeNull();
		expect(formatClassDate("not-a-date", "en")).toBeNull();
		expect(formatCompactClassDate("not-a-date", "en")).toBeNull();
	});
});
