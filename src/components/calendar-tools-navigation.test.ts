import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("attendance entry navigation", () => {
	const topActions = readFileSync(new URL("./CalendarTopActions.tsx", import.meta.url), "utf8");
	const sidebar = readFileSync(new URL("./Sidebar.tsx", import.meta.url), "utf8");
	const page = readFileSync(new URL("./AuthenticatedHome.tsx", import.meta.url), "utf8");

	test("lives in the Sidebar nav instead of Calendar Tools", () => {
		expect(sidebar).toContain('href: "/attendance-grid"');
		expect(topActions).not.toContain("/attendance-grid");
	});

	test("is available when the signed-in user has no courses", () => {
		expect(page).toMatch(/<CalendarTopActions\s+courses=\{courses\}[\s\S]*?\/>/);
		expect(page).not.toMatch(/courses\.length\s*>\s*0\s*\?\s*<CalendarTopActions/);
	});
});

describe("calendar subscription navigation", () => {
	const topActions = readFileSync(new URL("./CalendarTopActions.tsx", import.meta.url), "utf8");
	const sidebar = readFileSync(new URL("./Sidebar.tsx", import.meta.url), "utf8");
	const page = readFileSync(new URL("./AuthenticatedHome.tsx", import.meta.url), "utf8");

	test("is owned by Calendar Tools instead of the desktop Sidebar", () => {
		expect(topActions).toContain('import SubscribeButton from "./SubscribeButton"');
		expect(topActions).toMatch(/\{discordId && \([\s\S]*?<SubscribeButton discordId=\{discordId\} \/>[\s\S]*?\)\}/);
		expect(topActions.indexOf("<SubscribeButton")).toBeLessThan(topActions.indexOf('aria-label={t("semester")}'));
		expect(sidebar).not.toContain("SubscribeButton");
	});

	test("receives the signed-in user's Discord ID", () => {
		expect(page).toContain("discordId={session.user.discordId}");
	});
});

describe("calendar sharing navigation", () => {
	const topActions = readFileSync(new URL("./CalendarTopActions.tsx", import.meta.url), "utf8");
	const shareButton = readFileSync(new URL("./ShareCalendarButton.tsx", import.meta.url), "utf8");

	test("keeps the public sharing control inside Calendar Tools", () => {
		expect(topActions).toContain('import ShareCalendarButton from "./ShareCalendarButton"');
		expect(topActions).toContain("<ShareCalendarButton />");
		expect(topActions.indexOf("<SubscribeButton")).toBeLessThan(topActions.indexOf("<ShareCalendarButton"));
	});

	test("portals the sharing dialog outside the narrow tools popover", () => {
		expect(shareButton).toContain('import { createPortal } from "react-dom"');
		expect(shareButton).toContain("document.body");
	});
});
