import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

const sidebar = read("./Sidebar.tsx");
const home = read("./AuthenticatedHome.tsx");
const toolsPage = read("./CalendarToolsPage.tsx");
const eventsPage = read("./EventsManagerPage.tsx");
const shareButton = read("./ShareCalendarButton.tsx");

describe("attendance entry navigation", () => {
	test("lives in the Sidebar nav", () => {
		expect(sidebar).toContain('href: "/attendance-grid"');
	});
});

describe("calendar tools navigation", () => {
	// These controls used to sit in a dropdown in the timetable header. They now
	// have their own route, and the header no longer carries the buttons.
	test("no longer sits in the timetable header", () => {
		expect(home).not.toContain("CalendarTopActions");
	});

	test("is reachable from the Sidebar", () => {
		expect(sidebar).toContain('href: "/tools"');
		expect(sidebar).toContain('href: "/events"');
	});

	test("the tools page owns subscription, export and sharing", () => {
		expect(toolsPage).toContain("/api/calendar/");
		expect(toolsPage).toContain("exportSemesterIcs");
		expect(toolsPage).toContain("<ShareCalendarButton />");
	});

	test("the events page owns event removal", () => {
		expect(eventsPage).toContain("previewDeleteEventsByDateRange");
		expect(eventsPage).toContain("deleteEventsByDateRange");
	});
});

describe("calendar sharing", () => {
	test("portals the sharing dialog outside its container", () => {
		expect(shareButton).toContain('import { createPortal } from "react-dom"');
		expect(shareButton).toContain("document.body");
	});
});
