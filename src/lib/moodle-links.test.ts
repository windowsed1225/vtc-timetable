import { describe, expect, test } from "bun:test";
import {
	MOODLE_HOME_URL,
	resolveMoodleActivityUrl,
	resolveMoodleCourseUrl,
	resolveMoodleTodoUrl,
} from "@/lib/moodle-links";

describe("resolveMoodleCourseUrl", () => {
	test("accepts a verified VTC Moodle course page", () => {
		expect(resolveMoodleCourseUrl("https://moodle.vtc.edu.hk/course/view.php?id=4915")).toBe(
			"https://moodle.vtc.edu.hk/course/view.php?id=4915",
		);
	});

	test("rejects activity links because this resolver is course-pages only", () => {
		expect(resolveMoodleCourseUrl("https://moodle.vtc.edu.hk/mod/assign/view.php?id=123")).toBeNull();
	});

	test("rejects lookalike hosts and non-HTTPS URLs", () => {
		expect(resolveMoodleCourseUrl("https://moodle.vtc.edu.hk.example.com/course/view.php?id=1")).toBeNull();
		expect(resolveMoodleCourseUrl("http://moodle.vtc.edu.hk/course/view.php?id=1")).toBeNull();
	});

	test("exposes the canonical Moodle home URL", () => {
		expect(MOODLE_HOME_URL).toBe("https://moodle.vtc.edu.hk/");
	});
});

describe("resolveMoodleActivityUrl", () => {
	test("accepts the activity modules getMoodleTimetable returns as actionUrl", () => {
		expect(resolveMoodleActivityUrl("https://moodle.vtc.edu.hk/mod/assign/view.php?id=123")).toBe(
			"https://moodle.vtc.edu.hk/mod/assign/view.php?id=123",
		);
		expect(resolveMoodleActivityUrl("https://moodle.vtc.edu.hk/mod/quiz/view.php?id=98")).toBe(
			"https://moodle.vtc.edu.hk/mod/quiz/view.php?id=98",
		);
	});

	test("rejects course pages, non-numeric ids and traversal in the module name", () => {
		expect(resolveMoodleActivityUrl("https://moodle.vtc.edu.hk/course/view.php?id=1")).toBeNull();
		expect(resolveMoodleActivityUrl("https://moodle.vtc.edu.hk/mod/assign/view.php?id=abc")).toBeNull();
		expect(resolveMoodleActivityUrl("https://moodle.vtc.edu.hk/mod/../admin/view.php?id=1")).toBeNull();
	});

	test("rejects lookalike hosts and non-HTTPS URLs", () => {
		expect(resolveMoodleActivityUrl("https://evil.example.com/mod/assign/view.php?id=1")).toBeNull();
		expect(resolveMoodleActivityUrl("http://moodle.vtc.edu.hk/mod/assign/view.php?id=1")).toBeNull();
	});
});

describe("resolveMoodleTodoUrl", () => {
	test("prefers the activity over the course page", () => {
		expect(
			resolveMoodleTodoUrl(
				"https://moodle.vtc.edu.hk/mod/assign/view.php?id=123",
				"https://moodle.vtc.edu.hk/course/view.php?id=4915",
			),
		).toBe("https://moodle.vtc.edu.hk/mod/assign/view.php?id=123");
	});

	test("falls back to the course page when the activity link does not verify", () => {
		expect(resolveMoodleTodoUrl("javascript:alert(1)", "https://moodle.vtc.edu.hk/course/view.php?id=4915")).toBe(
			"https://moodle.vtc.edu.hk/course/view.php?id=4915",
		);
		expect(resolveMoodleTodoUrl(undefined, "https://moodle.vtc.edu.hk/course/view.php?id=4915")).toBe(
			"https://moodle.vtc.edu.hk/course/view.php?id=4915",
		);
	});

	test("returns null when neither URL verifies, so callers offer Moodle home", () => {
		expect(resolveMoodleTodoUrl(undefined, undefined)).toBeNull();
		expect(resolveMoodleTodoUrl("https://phish.example.com/mod/assign/view.php?id=1", "not a url")).toBeNull();
	});
});

describe("year-prefixed Moodle hosts", () => {
	test("accepts moodleNNNN.vtc.edu.hk activity and course pages", () => {
		expect(
			resolveMoodleActivityUrl("https://moodle2627.vtc.edu.hk/mod/quiz/view.php?id=233905"),
		).toBe("https://moodle2627.vtc.edu.hk/mod/quiz/view.php?id=233905");
		expect(
			resolveMoodleCourseUrl("https://moodle2627.vtc.edu.hk/course/view.php?id=2531"),
		).toBe("https://moodle2627.vtc.edu.hk/course/view.php?id=2531");
		expect(
			resolveMoodleTodoUrl(
				"https://moodle2627.vtc.edu.hk/mod/quiz/view.php?id=233905",
				"https://moodle2627.vtc.edu.hk/course/view.php?id=2531",
			),
		).toBe("https://moodle2627.vtc.edu.hk/mod/quiz/view.php?id=233905");
	});

	test("still rejects lookalike year hosts", () => {
		expect(resolveMoodleActivityUrl("https://moodle2627.vtc.edu.hk.evil.com/mod/quiz/view.php?id=1")).toBeNull();
		expect(resolveMoodleCourseUrl("https://notmoodle2627.vtc.edu.hk/course/view.php?id=1")).toBeNull();
	});
});
