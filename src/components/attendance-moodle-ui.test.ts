import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { courseHref } from "@/lib/course-route";

const attendanceSource = readFileSync(
	new URL("./AttendanceOverview.tsx", import.meta.url),
	"utf8",
);
const coursePageSource = readFileSync(
	new URL("../app/[locale]/courses/[courseCode]/page.tsx", import.meta.url),
	"utf8",
);
const courseDetailSource = readFileSync(
	new URL("./CourseDetailView.tsx", import.meta.url),
	"utf8",
);
const moodlePageSource = readFileSync(new URL("./MoodlePage.tsx", import.meta.url), "utf8");
const enMessages = JSON.parse(readFileSync(new URL("../../messages/en.json", import.meta.url), "utf8"));
const zhMessages = JSON.parse(
	readFileSync(new URL("../../messages/zh-HK.json", import.meta.url), "utf8"),
);

describe("attendance and Moodle UI wiring", () => {
	test("opens the existing attendance-entry modal instead of the hours grid", () => {
		expect(attendanceSource).toContain("<AttendanceModal");
		expect(attendanceSource).toContain('aria-haspopup="dialog"');
		expect(attendanceSource).not.toContain(
			'href="/attendance-grid" className="attendance-entry-button"',
		);
	});

	test("mounts the real-data Moodle panel on the dashboard page", () => {
		expect(moodlePageSource).toContain("<MoodleTodoCard");
	});

	test("also mounts Moodle on the home timetable", () => {
		const homeSource = readFileSync(new URL("./AuthenticatedHome.tsx", import.meta.url), "utf8");
		expect(homeSource).toContain("<MoodleTodoCard");
		expect(homeSource).toContain("<NextClassCard");
		expect(homeSource).toContain('className="home-top-grid"');
	});
});

describe("clickable course-attendance cards", () => {
	test("each card is a router Link built from the canonical course code", () => {
		expect(attendanceSource).toContain('import { courseHref } from "@/lib/course-route"');
		expect(attendanceSource).toContain('import { Link } from "@/lib/navigation"');
		expect(attendanceSource).toContain("href={courseHref(row.course.courseCode)}");
		expect(attendanceSource).toContain('className="attendance-course-card"');
		// Semantic link — not a clickable div with an onClick navigator.
		expect(attendanceSource).not.toMatch(
			/<div[^>]*className="attendance-course-card"[^>]*onClick/,
		);
	});

	test("ITP4501 and other codes generate relative /courses/<lowercase> routes", () => {
		expect(courseHref("ITP4501")).toBe("/courses/itp4501");
		expect(courseHref("ITP4507")).toBe("/courses/itp4507");
		expect(courseHref("ITP4915")).toBe("/courses/itp4915");
		expect(courseHref("GEN4001")).toBe("/courses/gen4001");
		for (const code of ["ITP4501", "GEN4001", "LAN3107"]) {
			expect(courseHref(code).startsWith("/courses/")).toBe(true);
			expect(courseHref(code)).not.toContain("localhost");
			expect(courseHref(code)).not.toContain("//");
		}
	});

	test("cards expose an accessible label with code and name", () => {
		expect(attendanceSource).toContain('aria-label={tCourse("viewCourse"');
		expect(attendanceSource).toContain("code: row.course.courseCode");
		expect(attendanceSource).toContain("name: row.course.courseName");
		expect(enMessages.courseDetail.viewCourse).toContain("{code}");
		expect(enMessages.courseDetail.viewCourse).toContain("{name}");
		expect(zhMessages.courseDetail.viewCourse).toBe("查看 {code} {name} 的課程詳情");
	});

	test("course-detail route reuses CourseDetailView with canonicalised codes", () => {
		expect(coursePageSource).toContain("canonicalCourseCode");
		expect(coursePageSource).toContain("<CourseDetailView courseId={canonicalCourseCode(courseCode)}");
		// Unknown / invalid segments become null → not-found state, not a crash.
		expect(courseDetailSource).toContain("courseId === null");
		expect(courseDetailSource).toContain('t("notFoundTitle")');
		expect(courseDetailSource).toContain('href="/attendance"');
	});
});
