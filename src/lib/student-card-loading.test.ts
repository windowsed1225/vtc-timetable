import { describe, expect, test } from "bun:test";
import { studentCardLoadingProgress } from "./student-card-loading";

describe("student card loading progress", () => {
	test("moves through account, e-card, and preparation stages without reaching 100 before completion", () => {
		expect(studentCardLoadingProgress(0)).toEqual({ stage: "account", percent: 8 });
		expect(studentCardLoadingProgress(900).stage).toBe("ecard");
		expect(studentCardLoadingProgress(2_500).stage).toBe("details");
		expect(studentCardLoadingProgress(30_000).percent).toBe(92);
	});

	test("clamps invalid elapsed times to the initial state", () => {
		expect(studentCardLoadingProgress(-1)).toEqual({ stage: "account", percent: 8 });
		expect(studentCardLoadingProgress(Number.NaN)).toEqual({ stage: "account", percent: 8 });
	});
});
