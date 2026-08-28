import { describe, expect, test } from "bun:test";
import {
	CACHE_SCHEMA_VERSION,
	attendanceCacheKey,
	coursesCacheKey,
	timetableCacheKey,
	userCacheVersionKey,
} from "./cache-policy";

describe("cache key isolation", () => {
	test("scopes keys by schema version, user, and cache version", () => {
		expect(CACHE_SCHEMA_VERSION).toBe("v1");
		expect(userCacheVersionKey("user-a")).toBe("vtc:v1:user:user-a:cv");
		expect(timetableCacheKey("user-a", 3)).toBe("vtc:v1:user:user-a:cv3:timetable");
		expect(coursesCacheKey("user-b", 3)).toBe("vtc:v1:user:user-b:cv3:courses");
		expect(timetableCacheKey("user-a", 3)).not.toBe(timetableCacheKey("user-b", 3));
	});

	test("includes the effective passing rate in attendance keys", () => {
		expect(attendanceCacheKey("user-a", 1, 80)).toBe("vtc:v1:user:user-a:cv1:attendance:80");
		expect(attendanceCacheKey("user-a", 1, 75)).toBe("vtc:v1:user:user-a:cv1:attendance:75");
	});

	test("JSON cache payloads round-trip without secrets", () => {
		const payload = {
			courseCode: "IT114105",
			gracePeriodThreshold: 80,
			events: [{ start: new Date("2026-08-28T01:30:00.000Z").toISOString() }],
		};
		const encoded = JSON.stringify(payload);
		expect(encoded).not.toContain("token");
		expect(JSON.parse(encoded)).toEqual(payload);
	});
});

describe("redis fail-open", () => {
	test("treats an unset REDIS_URL as disabled and cache reads miss through", async () => {
		const previous = process.env.REDIS_URL;
		delete process.env.REDIS_URL;
		try {
			const { getRedis, isRedisConfigured, pingRedis } = await import("./redis");
			const { cacheGet } = await import("./cache");
			expect(isRedisConfigured()).toBe(false);
			expect(await getRedis()).toBeNull();
			expect(await pingRedis()).toBe("disabled");
			expect(await cacheGet("vtc:v1:user:user-a:cv0:timetable")).toBeNull();
			const { cacheAside } = await import("./cache");
			expect(await cacheAside("vtc:v1:user:user-a:cv0:timetable", 60, async () => ({ source: "mongo" }))).toEqual({
				source: "mongo",
			});
		} finally {
			if (previous === undefined) delete process.env.REDIS_URL;
			else process.env.REDIS_URL = previous;
		}
	});
});
