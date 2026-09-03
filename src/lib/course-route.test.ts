import { describe, expect, it } from "bun:test";
import { canonicalCourseCode, courseHref } from "./course-route";

describe("courseHref", () => {
	it("lowercases the canonical course code", () => {
		expect(courseHref("ITP4501")).toBe("/courses/itp4501");
		expect(courseHref("ITP4507")).toBe("/courses/itp4507");
		expect(courseHref("ITP4915")).toBe("/courses/itp4915");
		expect(courseHref("GEN4001")).toBe("/courses/gen4001");
	});

	it("keeps follow-up sittings distinct", () => {
		expect(courseHref("ITP4501A")).toBe("/courses/itp4501a");
	});

	it("accepts codes that are already lowercase or padded", () => {
		expect(courseHref("  itp4501 ")).toBe("/courses/itp4501");
	});

	it("stays a relative path on the app's own origin", () => {
		for (const code of ["ITP4501", "GEN4001", "LAN3107"]) {
			expect(courseHref(code).startsWith("/courses/")).toBe(true);
			expect(courseHref(code)).not.toContain("//");
		}
	});

	it("percent-encodes anything unexpected rather than emitting raw path separators", () => {
		expect(courseHref("../secret")).not.toContain("/../");
	});
});

describe("canonicalCourseCode", () => {
	it("round-trips a href segment back to the stored code", () => {
		expect(canonicalCourseCode("itp4501")).toBe("ITP4501");
		expect(canonicalCourseCode("GEN4001")).toBe("GEN4001");
		expect(canonicalCourseCode("itp4501a")).toBe("ITP4501A");
	});

	it("rejects segments that are not course codes", () => {
		expect(canonicalCourseCode("")).toBeNull();
		expect(canonicalCourseCode(null)).toBeNull();
		expect(canonicalCourseCode("not-a-course")).toBeNull();
		expect(canonicalCourseCode("../../etc/passwd")).toBeNull();
		expect(canonicalCourseCode("1234")).toBeNull();
		expect(canonicalCourseCode("雲端運算")).toBeNull();
	});

	it("survives a malformed percent escape", () => {
		expect(canonicalCourseCode("%E0%A4%A")).toBeNull();
	});
});
