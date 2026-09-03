import { describe, expect, test } from "bun:test";
import { hasOfficialResult, isLockedSession, sessionState } from "./session-state";

const HOUR = 60 * 60 * 1000;

/** A class that ran earlier on the same local day as `now`. */
function endedToday(now: Date, hoursAgo = 2) {
	return { start: new Date(now.getTime() - (hoursAgo + 1) * HOUR), end: new Date(now.getTime() - hoursAgo * HOUR) };
}

describe("isLockedSession", () => {
	test("skips the API once VTC has published a presence code", () => {
		expect(isLockedSession({ attendanceStatusCode: 1 })).toBe(true);
		expect(isLockedSession({ attendanceStatusCode: 3 })).toBe(true);
		expect(isLockedSession({ status: "ABSENT" })).toBe(true);
		expect(isLockedSession({ status: "CANCELED" })).toBe(true);
	});

	test("does not treat FINISHED as a result", () => {
		// The plain timetable sync writes FINISHED for anything whose end time has
		// passed, with no attendance code, so it proves nothing about presence.
		expect(isLockedSession({ status: "FINISHED", attendanceStatusCode: null })).toBe(false);
		expect(hasOfficialResult({ status: "FINISHED" })).toBe(false);
	});
});

describe("sessionState", () => {
	const now = new Date("2026-09-03T15:00:00");

	test("a class that ended today with no result is awaiting tomorrow", () => {
		expect(sessionState({ ...endedToday(now), status: "FINISHED", attendanceStatusCode: null }, now)).toBe("awaiting");
	});

	test("the same class becomes the official result once it lands", () => {
		const ended = endedToday(now);
		expect(sessionState({ ...ended, status: "FINISHED", attendanceStatusCode: 1 }, now)).toBe("attended");
		expect(sessionState({ ...ended, status: "ABSENT", attendanceStatusCode: null }, now)).toBe("absent");
	});

	test("stops promising tomorrow once the day has passed", () => {
		const yesterday = { start: new Date("2026-09-02T09:00:00"), end: new Date("2026-09-02T11:00:00") };
		expect(sessionState({ ...yesterday, status: "FINISHED", attendanceStatusCode: null }, now)).toBe("noRecord");
	});

	test("reads today from the local day, not UTC", () => {
		// 00:30 local on 3 Sep is still 2 Sep in UTC; the class ended at 00:15 the
		// same local morning and must not fall through to noRecord.
		const justAfterMidnight = new Date("2026-09-03T00:30:00");
		const ended = { start: new Date("2026-09-02T23:15:00"), end: new Date("2026-09-03T00:15:00") };
		expect(sessionState({ ...ended, attendanceStatusCode: null }, justAfterMidnight)).toBe("awaiting");
	});

	test("covers the rest of the machine", () => {
		expect(sessionState({ start: new Date(now.getTime() + HOUR), end: new Date(now.getTime() + 2 * HOUR) }, now)).toBe("upcoming");
		expect(sessionState({ start: new Date(now.getTime() - HOUR), end: new Date(now.getTime() + HOUR) }, now)).toBe("ongoing");
		expect(sessionState({ ...endedToday(now), status: "CANCELED" }, now)).toBe("cancelled");
	});

	test("never shows an in-progress class as absent", () => {
		const ongoing = { start: new Date(now.getTime() - HOUR), end: new Date(now.getTime() + HOUR) };
		expect(sessionState({ ...ongoing, status: "FINISHED", attendanceStatusCode: null }, now)).toBe("ongoing");
	});
});
