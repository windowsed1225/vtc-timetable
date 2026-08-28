import { describe, expect, test } from "bun:test";
import { createEvents } from "ics";
import { eventToIcsAttributes } from "./calendar-ics";

describe("eventToIcsAttributes", () => {
	test("stringifies numeric semester so ics createEvents accepts the event", () => {
		const attrs = eventToIcsAttributes({
			vtc_id: "evt-1",
			courseTitle: "Programming",
			courseCode: "IT114105",
			startTime: new Date("2026-09-01T01:00:00.000Z"),
			endTime: new Date("2026-09-01T03:00:00.000Z"),
			location: "N318",
			lecturerName: "Ada",
			semester: 1,
		});
		expect(attrs.categories).toEqual(["IT114105", "SEM 1"]);
		const { error, value } = createEvents([attrs]);
		expect(error).toBeNull();
		expect(value).toContain("CATEGORIES:IT114105,SEM 1");
	});
});
