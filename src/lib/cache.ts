import { sharedCalendarVersionKey, userCacheVersionKey } from "@/lib/cache-policy";
import { getRedis } from "@/lib/redis";

const inflight = new Map<string, Promise<unknown>>();

function logCacheError(operation: string, error: unknown): void {
	const name = error instanceof Error ? error.name : "Error";
	console.error("cache error", { operation, name });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
	try {
		const redis = await getRedis();
		if (!redis) return null;
		const raw = await redis.get(key);
		if (raw === null) return null;
		return JSON.parse(raw) as T;
	} catch (error) {
		logCacheError("get", error);
		return null;
	}
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
	try {
		const redis = await getRedis();
		if (!redis) return;
		await redis.setEx(key, ttlSeconds, JSON.stringify(value));
	} catch (error) {
		logCacheError("set", error);
	}
}

export async function cacheDelete(key: string): Promise<void> {
	try {
		const redis = await getRedis();
		if (!redis) return;
		await redis.del(key);
	} catch (error) {
		logCacheError("delete", error);
	}
}

const versionInflight = new Map<string, Promise<number>>();

async function getCacheVersion(versionKey: string): Promise<number> {
	const existing = versionInflight.get(versionKey);
	if (existing) return existing;

	const pending = (async () => {
		try {
			const redis = await getRedis();
			if (!redis) return 0;
			const raw = await redis.get(versionKey);
			const parsed = raw === null ? 0 : Number(raw);
			return Number.isFinite(parsed) ? parsed : 0;
		} catch (error) {
			logCacheError("version", error);
			return 0;
		}
	})().finally(() => {
		versionInflight.delete(versionKey);
	});

	versionInflight.set(versionKey, pending);
	return pending;
}

async function bumpCacheVersion(versionKey: string): Promise<void> {
	try {
		const redis = await getRedis();
		if (!redis) return;
		await redis.incr(versionKey);
	} catch (error) {
		logCacheError("invalidate", error);
	}
}

export async function getUserCacheVersion(userId: string): Promise<number> {
	return getCacheVersion(userCacheVersionKey(userId));
}

export async function invalidateUserCaches(userId: string): Promise<void> {
	await bumpCacheVersion(userCacheVersionKey(userId));
}

export async function getSharedCalendarCacheVersion(scope: string): Promise<number> {
	return getCacheVersion(sharedCalendarVersionKey(scope));
}

/** Drops every cached view of a share the moment its link is regenerated or disabled. */
export async function invalidateSharedCalendarCache(scope: string): Promise<void> {
	await bumpCacheVersion(sharedCalendarVersionKey(scope));
}

export async function cacheAside<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
	const cached = await cacheGet<T>(key);
	if (cached !== null) return cached;

	const existing = inflight.get(key);
	if (existing) return existing as Promise<T>;

	const pending = (async () => {
		const value = await loader();
		if (value !== null && value !== undefined) {
			await cacheSet(key, value, ttlSeconds);
		}
		return value;
	})().finally(() => {
		inflight.delete(key);
	});

	inflight.set(key, pending);
	return pending;
}
