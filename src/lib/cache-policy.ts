import { DEFAULT_GRACE_PERIOD_THRESHOLD } from "@/lib/grace-period";

export const CACHE_SCHEMA_VERSION = "v1";

function readTtlSeconds(envName: string, fallback: number): number {
	const raw = process.env[envName];
	if (!raw) return fallback;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.floor(parsed);
}

export const CACHE_TTL_SECONDS = {
	timetable: readTtlSeconds("CACHE_TTL_TIMETABLE_SECONDS", 5 * 60),
	courses: readTtlSeconds("CACHE_TTL_COURSES_SECONDS", 5 * 60),
	attendance: readTtlSeconds("CACHE_TTL_ATTENDANCE_SECONDS", 60),
	moodle: readTtlSeconds("CACHE_TTL_MOODLE_SECONDS", 5 * 60),
	printQuota: readTtlSeconds("CACHE_TTL_PRINT_QUOTA_SECONDS", 2 * 60),
	programme: readTtlSeconds("CACHE_TTL_PROGRAMME_SECONDS", 60 * 60),
	courseHours: readTtlSeconds("CACHE_TTL_COURSE_HOURS_SECONDS", 60),
} as const;

export type CacheKind = keyof typeof CACHE_TTL_SECONDS;

function userPrefix(userId: string, cacheVersion: number): string {
	return `vtc:${CACHE_SCHEMA_VERSION}:user:${userId}:cv${cacheVersion}`;
}

export function userCacheVersionKey(userId: string): string {
	return `vtc:${CACHE_SCHEMA_VERSION}:user:${userId}:cv`;
}

export function timetableCacheKey(userId: string, cacheVersion: number): string {
	return `${userPrefix(userId, cacheVersion)}:timetable`;
}

export function coursesCacheKey(userId: string, cacheVersion: number): string {
	return `${userPrefix(userId, cacheVersion)}:courses`;
}

export function attendanceCacheKey(
	userId: string,
	cacheVersion: number,
	threshold: number = DEFAULT_GRACE_PERIOD_THRESHOLD,
): string {
	return `${userPrefix(userId, cacheVersion)}:attendance:${threshold}`;
}

export function moodleCacheKey(userId: string, cacheVersion: number, year: number, month: number): string {
	return `${userPrefix(userId, cacheVersion)}:moodle:${year}-${String(month).padStart(2, "0")}`;
}

export function printQuotaCacheKey(userId: string, cacheVersion: number): string {
	return `${userPrefix(userId, cacheVersion)}:print-quota`;
}

export function programmeCacheKey(userId: string, cacheVersion: number): string {
	return `${userPrefix(userId, cacheVersion)}:programme:v2`;
}

export function courseHoursCacheKey(userId: string, cacheVersion: number, courseCode: string): string {
	return `${userPrefix(userId, cacheVersion)}:course:${encodeURIComponent(courseCode)}:hours`;
}
