import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	calendarSharePath,
	calendarOwnerViewPath,
	calendarShareRange,
	createCalendarShareToken,
	currentCalendarShareMonth,
	isValidDiscordId,
	isValidCalendarShareToken,
	normalizeCalendarShareMonth,
	normalizeCalendarShareVersion,
	normalizeCalendarShareView,
	sharedCalendarWindowEnd,
	shiftCalendarShareMonth,
	toSharedCalendarEvents,
} from "./calendar-share";

const userModelSource = readFileSync(new URL("../models/User.ts", import.meta.url), "utf8");
const calendarShareSource = readFileSync(new URL("./calendar-share.ts", import.meta.url), "utf8");
const calendarLoaderSource = readFileSync(new URL("./load-shared-calendar.ts", import.meta.url), "utf8");

describe("calendar sharing", () => {
	test("keeps client-imported calendar helpers browser-safe", () => {
		expect(calendarShareSource).not.toContain('from "node:crypto"');
		expect(calendarShareSource).not.toContain("Buffer.");
	});

	test("stores the capability token as a unique optional user field", () => {
		expect(userModelSource).toContain("calendarShareToken?: string");
		expect(userModelSource).toMatch(/calendarShareToken:[\s\S]*unique:\s*true[\s\S]*sparse:\s*true/);
	});

	test("creates a 192-bit URL-safe capability token", () => {
		const token = createCalendarShareToken((size) => Buffer.alloc(size, 0xff));

		expect(token).toBe("________________________________");
		expect(isValidCalendarShareToken(token)).toBe(true);
	});

	test("rejects malformed capability tokens", () => {
		expect(isValidCalendarShareToken("short")).toBe(false);
		expect(isValidCalendarShareToken("a".repeat(31) + "/")).toBe(false);
		expect(isValidCalendarShareToken("a".repeat(33))).toBe(false);
	});

	test("builds a locale-aware public calendar path", () => {
		const token = "a".repeat(32);
		expect(calendarSharePath(token, "month")).toBe(`/share/calendar/${token}?view=month`);
		expect(calendarSharePath("bad/token")).toBeNull();
	});

	test("accepts Discord IDs only for the owner-only viewer path", () => {
		expect(isValidDiscordId("123456789012345678")).toBe(true);
		expect(isValidDiscordId("1234")).toBe(false);
		expect(isValidDiscordId("12345678901234567x")).toBe(false);
		expect(calendarOwnerViewPath("123456789012345678", "day")).toBe(
			"/share/calendar/123456789012345678?view=day",
		);
		expect(calendarOwnerViewPath("not-an-id", "week")).toBeNull();
	});

	test("gates Discord ID calendar loading behind the configured owner", () => {
		expect(calendarLoaderSource).toContain("isPlaygroundOwner(requesterDiscordId)");
		expect(calendarLoaderSource).toContain("isValidDiscordId(discordId)");
	});

	test("normalizes day, week, and month share views", () => {
		expect(normalizeCalendarShareView("day")).toBe("day");
		expect(normalizeCalendarShareView("month")).toBe("month");
		expect(normalizeCalendarShareView("anything-else")).toBe("week");
	});

	test("calculates Hong Kong day and month boundaries", () => {
		const now = new Date("2026-08-31T04:00:00.000Z");
		const day = calendarShareRange("day", now);
		const month = calendarShareRange("month", now);

		expect(day.start.toISOString()).toBe("2026-08-30T16:00:00.000Z");
		expect(day.end.toISOString()).toBe("2026-08-31T16:00:00.000Z");
		expect(month.start.toISOString()).toBe("2026-07-31T16:00:00.000Z");
		expect(month.end.toISOString()).toBe("2026-08-31T16:00:00.000Z");
	});

	test("normalizes an optional YYYY-MM anchor for month links", () => {
		expect(normalizeCalendarShareMonth("2026-09")).toBe("2026-09");
		expect(normalizeCalendarShareMonth(" 2026-01 ")).toBe("2026-01");
		expect(normalizeCalendarShareMonth("2026-13")).toBeNull();
		expect(normalizeCalendarShareMonth("2026-9")).toBeNull();
		expect(normalizeCalendarShareMonth("1999-09")).toBeNull();
		expect(normalizeCalendarShareMonth(undefined)).toBeNull();
	});

	test("reports the current Hong Kong month", () => {
		expect(currentCalendarShareMonth(new Date("2026-08-31T16:30:00.000Z"))).toBe("2026-09");
	});

	test("anchors the month range to a chosen month", () => {
		const now = new Date("2026-08-31T04:00:00.000Z");
		const chosen = calendarShareRange("month", now, "2026-12");

		expect(chosen.start.toISOString()).toBe("2026-11-30T16:00:00.000Z");
		expect(chosen.end.toISOString()).toBe("2026-12-31T16:00:00.000Z");
		expect(calendarShareRange("month", now, "nope").start.toISOString()).toBe("2026-07-31T16:00:00.000Z");
		expect(calendarShareRange("week", now, "2026-12").start.toISOString()).toBe("2026-08-30T16:00:00.000Z");
	});

	test("carries a chosen month across every view link", () => {
		const token = "a".repeat(32);
		expect(calendarSharePath(token, "month", { month: "2026-12" })).toBe(
			`/share/calendar/${token}?view=month&month=2026-12`,
		);
		expect(calendarSharePath(token, "week", { month: "2026-12" })).toBe(
			`/share/calendar/${token}?view=week&month=2026-12`,
		);
		expect(calendarSharePath(token, "month")).toBe(`/share/calendar/${token}?view=month`);
		expect(calendarSharePath(token, "month", { month: "2026-13" })).toBe(
			`/share/calendar/${token}?view=month`,
		);
		expect(calendarOwnerViewPath("123456789012345678", "month", { month: "2026-12" })).toBe(
			"/share/calendar/123456789012345678?view=month&month=2026-12",
		);
	});

	test("appends the Discord cache buster last", () => {
		const token = "a".repeat(32);
		expect(calendarSharePath(token, "month", { month: "2026-12", version: "2" })).toBe(
			`/share/calendar/${token}?view=month&month=2026-12&v=2`,
		);
		expect(calendarSharePath(token, "week", { version: "abc-1_9" })).toBe(
			`/share/calendar/${token}?view=week&v=abc-1_9`,
		);
		expect(normalizeCalendarShareVersion(" 2 ")).toBe("2");
		expect(normalizeCalendarShareVersion("a".repeat(17))).toBeNull();
		expect(normalizeCalendarShareVersion("bad value")).toBeNull();
		expect(normalizeCalendarShareVersion("")).toBeNull();
		expect(calendarSharePath(token, "week", { version: "bad value" })).toBe(
			`/share/calendar/${token}?view=week`,
		);
	});

	test("steps the month anchor across year boundaries", () => {
		expect(shiftCalendarShareMonth("2026-12", 1)).toBe("2027-01");
		expect(shiftCalendarShareMonth("2026-01", -1)).toBe("2025-12");
		expect(shiftCalendarShareMonth("2026-09", 0)).toBe("2026-09");
		expect(shiftCalendarShareMonth("nope", 1)).toBe("nope");
	});

	test("uses a seven-day sharing window", () => {
		const now = new Date("2026-08-31T04:00:00.000Z");
		expect(sharedCalendarWindowEnd(now).toISOString()).toBe("2026-09-07T04:00:00.000Z");
	});

	test("publishes only safe upcoming event fields", () => {
		const now = new Date("2026-08-31T04:00:00.000Z");
		const events = toSharedCalendarEvents(
			[
				{
					vtcStudentId: "260000000",
					courseCode: "ITP4507",
					courseTitle: "Web Services",
					lessonType: "Lecture",
					startTime: new Date("2026-08-31T05:00:00.000Z"),
					endTime: new Date("2026-08-31T07:00:00.000Z"),
					location: "KT123",
					colorIndex: 2,
					status: "UPCOMING",
					lecturerName: "Private Lecturer",
					attendanceStatusCode: 1,
				},
				{
					courseCode: "OLD1000",
					courseTitle: "Past class",
					startTime: new Date("2026-08-30T05:00:00.000Z"),
					endTime: new Date("2026-08-30T07:00:00.000Z"),
					status: "FINISHED",
				},
				{
					courseCode: "CAN1000",
					courseTitle: "Canceled class",
					startTime: new Date("2026-08-31T08:00:00.000Z"),
					endTime: new Date("2026-08-31T09:00:00.000Z"),
					status: "CANCELED",
				},
			],
			now,
		);

		expect(events).toEqual([
			{
				courseCode: "ITP4507",
				courseTitle: "Web Services",
				lessonType: "Lecture",
				startTime: "2026-08-31T05:00:00.000Z",
				endTime: "2026-08-31T07:00:00.000Z",
				location: "KT123",
				colorIndex: 2,
			},
		]);
		expect(JSON.stringify(events)).not.toMatch(/student|lecturer|attendance/i);
	});
});
