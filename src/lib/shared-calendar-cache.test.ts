import { beforeEach, expect, mock, test } from "bun:test";

const store = new Map<string, string>();
let dbConnections = 0;
let userLookups = 0;

const redisStub = {
	get: async (key: string) => store.get(key) ?? null,
	setEx: async (key: string, _ttl: number, value: string) => { store.set(key, value); },
	del: async (key: string) => { store.delete(key); },
	incr: async (key: string) => {
		const next = Number(store.get(key) ?? 0) + 1;
		store.set(key, String(next));
		return next;
	},
};

mock.module("@/lib/redis", () => ({ getRedis: async () => redisStub, isRedisConfigured: () => true }));
mock.module("@/lib/db", () => ({ default: async () => { dbConnections += 1; } }));
mock.module("@/models/User", () => ({
	default: {
		findOne: () => ({ select: () => ({ lean: async () => { userLookups += 1; return { vtcStudentId: "260000000", locale: "en" }; } }) }),
	},
}));
mock.module("@/models/Event", () => ({
	default: { find: () => ({ select: () => ({ sort: () => ({ lean: async () => [] }) }) }) },
}));

const { loadSharedCalendar } = await import("./load-shared-calendar");
const { invalidateSharedCalendarCache } = await import("./cache");

const token = "a".repeat(32);

beforeEach(() => { dbConnections = 0; userLookups = 0; });

test("serves a warm share from Redis without touching MongoDB", async () => {
	const first = await loadSharedCalendar(token, "month", "2026-09");
	expect(first?.month).toBe("2026-09");
	expect(dbConnections).toBe(1);

	// react cache() dedupes within a request, so ask for a different range too.
	const second = await loadSharedCalendar(token, "month", "2026-10");
	expect(second).not.toBeNull();
	expect(dbConnections).toBe(2);

	store.forEach((_value, key) => { if (!key.includes(":cv")) store.delete(key); });
	dbConnections = 0;
	userLookups = 0;
	const cached = await loadSharedCalendar(token, "month", "2026-09");
	expect(cached?.month).toBe("2026-09");
	expect(dbConnections).toBe(0);
	expect(userLookups).toBe(0);
});

test("revoking a link drops its cached copies", async () => {
	await invalidateSharedCalendarCache(token);
	dbConnections = 0;
	await loadSharedCalendar(token, "day", null);
	expect(dbConnections).toBe(1);
});
