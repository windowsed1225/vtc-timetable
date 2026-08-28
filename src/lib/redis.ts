import { createClient, type RedisClientType } from "redis";

interface RedisCache {
	client: RedisClientType | null;
	promise: Promise<RedisClientType | null> | null;
}

declare global {
	var redisCache: RedisCache | undefined;
}

const cached: RedisCache = globalThis.redisCache ?? { client: null, promise: null };

if (!globalThis.redisCache) {
	globalThis.redisCache = cached;
}

export function getRedisUrl(): string | undefined {
	const url = process.env.REDIS_URL?.trim();
	return url ? url : undefined;
}

export function isRedisConfigured(): boolean {
	return Boolean(getRedisUrl());
}

function logRedisError(operation: string, error: unknown): void {
	const name = error instanceof Error ? error.name : "Error";
	console.error("redis error", { operation, name });
}

export async function getRedis(): Promise<RedisClientType | null> {
	if (!isRedisConfigured()) return null;
	if (cached.client?.isOpen) return cached.client;

	if (!cached.promise) {
		cached.promise = (async () => {
			const url = getRedisUrl();
			if (!url) return null;

			const client = createClient({
				url,
				socket: {
					reconnectStrategy(retries) {
						if (retries > 10) return new Error("redis reconnect exhausted");
						return Math.min(retries * 200, 2000);
					},
				},
			});

			client.on("error", (error) => {
				logRedisError("client", error);
			});

			try {
				await client.connect();
				cached.client = client as RedisClientType;
				return cached.client;
			} catch (error) {
				logRedisError("connect", error);
				cached.promise = null;
				cached.client = null;
				try {
					await client.disconnect();
				} catch {
					// Connection never opened; ignore disconnect failure.
				}
				return null;
			}
		})();
	}

	return cached.promise;
}

export async function pingRedis(): Promise<"ok" | "disabled" | "error"> {
	if (!isRedisConfigured()) return "disabled";
	try {
		const client = await getRedis();
		if (!client) return "error";
		const result = await client.ping();
		return result === "PONG" ? "ok" : "error";
	} catch (error) {
		logRedisError("ping", error);
		return "error";
	}
}

export async function closeRedis(): Promise<void> {
	const client = cached.client;
	cached.client = null;
	cached.promise = null;
	if (!client) return;
	try {
		await client.quit();
	} catch {
		try {
			await client.disconnect();
		} catch (error) {
			logRedisError("disconnect", error);
		}
	}
}
