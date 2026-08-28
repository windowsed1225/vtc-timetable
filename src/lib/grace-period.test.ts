import { describe, expect, test } from "bun:test";
import {
	DEFAULT_GRACE_PERIOD_THRESHOLD,
	MAX_GRACE_PERIOD_THRESHOLD,
	MIN_GRACE_PERIOD_THRESHOLD,
	parseGracePeriodThreshold,
	resolveGracePeriodThreshold,
	storedGracePeriodOverride,
	thresholdOf,
} from "./grace-period";

describe("grace period threshold", () => {
	test("defaults to 80 when no override is stored", () => {
		expect(DEFAULT_GRACE_PERIOD_THRESHOLD).toBe(80);
		expect(resolveGracePeriodThreshold(undefined)).toBe(80);
		expect(resolveGracePeriodThreshold(null)).toBe(80);
		expect(thresholdOf({})).toBe(80);
		expect(storedGracePeriodOverride(undefined)).toBeNull();
	});

	test("uses a validated override instead of the default", () => {
		expect(resolveGracePeriodThreshold(75)).toBe(75);
		expect(thresholdOf({ gracePeriodThreshold: 92.5 })).toBe(92.5);
		expect(storedGracePeriodOverride(75)).toBe(75);
	});

	test("rejects invalid and out-of-range values", () => {
		expect(parseGracePeriodThreshold("abc")).toEqual({ ok: false, error: "invalid" });
		expect(parseGracePeriodThreshold(Number.NaN)).toEqual({ ok: false, error: "invalid" });
		expect(parseGracePeriodThreshold(Number.POSITIVE_INFINITY)).toEqual({ ok: false, error: "invalid" });
		expect(parseGracePeriodThreshold("")).toEqual({ ok: false, error: "invalid" });
		expect(parseGracePeriodThreshold(-1)).toEqual({ ok: false, error: "out_of_range" });
		expect(parseGracePeriodThreshold(0)).toEqual({ ok: false, error: "out_of_range" });
		expect(parseGracePeriodThreshold(101)).toEqual({ ok: false, error: "out_of_range" });
		expect(parseGracePeriodThreshold(MIN_GRACE_PERIOD_THRESHOLD).ok).toBe(true);
		expect(parseGracePeriodThreshold(MAX_GRACE_PERIOD_THRESHOLD).ok).toBe(true);
		expect(parseGracePeriodThreshold("80.4")).toEqual({ ok: true, value: 80.4 });
		expect(storedGracePeriodOverride(0)).toBeNull();
		expect(storedGracePeriodOverride(101)).toBeNull();
		expect(resolveGracePeriodThreshold(storedGracePeriodOverride(0))).toBe(80);
	});
});
