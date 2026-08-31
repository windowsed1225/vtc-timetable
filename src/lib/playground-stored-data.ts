import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import Event from "@/models/Event";
import User from "@/models/User";
import { SEMESTER_NUMBERS, type SemesterType } from "@/lib/semester";

/** Secrets that must never leave the server, even on an owner-gated surface. */
const USER_SECRETS = "-vtcToken -password -calendarShareToken" as const;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export type StoredAccount = {
	discordId: string;
	vtcStudentId: string | null;
	lastSync: Date | null;
	locale: string | null;
	hasToken: boolean;
	eventCount: number;
	attendanceCount: number;
};

export function parseStoredLimit(search: URLSearchParams): number | { error: string } {
	const raw = search.get("limit")?.trim();
	if (!raw) return DEFAULT_LIMIT;
	const value = Number(raw);
	if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
		return { error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
	}
	return value;
}

export function parseStoredSemester(search: URLSearchParams): SemesterType | null | { error: string } {
	const raw = search.get("semester")?.trim();
	if (!raw) return null;
	const value = Number(raw);
	if (!SEMESTER_NUMBERS.includes(value as SemesterType)) {
		return { error: `semester must be one of ${SEMESTER_NUMBERS.join(", ")}` };
	}
	return value as SemesterType;
}

/** Resolves the student the stored rows are keyed by. Returns null when no such account. */
async function resolveStudentId(discordId: string): Promise<{ vtcStudentId: string | null } | null> {
	await connectDB();
	const user = await User.findOne({ discordId }).select("vtcStudentId").lean();
	if (!user) return null;
	return { vtcStudentId: user.vtcStudentId ?? null };
}

export async function getStoredAccount(discordId: string): Promise<StoredAccount | null> {
	await connectDB();
	const user = await User.findOne({ discordId }).select("discordId vtcStudentId vtcToken lastSync locale").lean();
	if (!user) return null;

	const vtcStudentId = user.vtcStudentId ?? null;
	const [eventCount, attendanceCount] = vtcStudentId
		? await Promise.all([
				Event.countDocuments({ vtcStudentId }),
				Attendance.countDocuments({ vtcStudentId }),
			])
		: [0, 0];

	return {
		discordId,
		vtcStudentId,
		lastSync: user.lastSync ?? null,
		locale: user.locale ?? null,
		hasToken: Boolean(user.vtcToken),
		eventCount,
		attendanceCount,
	};
}

export async function getStoredUser(discordId: string): Promise<Record<string, unknown> | null> {
	await connectDB();
	const user = await User.findOne({ discordId }).select(USER_SECRETS).lean();
	if (!user) return null;
	// ObjectId/Date/Binary need their own toJSON; a plain recursive walk would mangle them.
	return JSON.parse(JSON.stringify(user)) as Record<string, unknown>;
}

export async function getStoredEvents(
	discordId: string,
	options: { semester: SemesterType | null; limit: number },
): Promise<unknown[] | null> {
	const account = await resolveStudentId(discordId);
	if (!account) return null;
	if (!account.vtcStudentId) return [];

	const filter: Record<string, unknown> = { vtcStudentId: account.vtcStudentId };
	if (options.semester) filter.semester = options.semester;

	return Event.find(filter).sort({ startTime: 1 }).limit(options.limit).lean();
}

export async function getStoredAttendance(
	discordId: string,
	options: { semester: SemesterType | null; limit: number },
): Promise<unknown[] | null> {
	const account = await resolveStudentId(discordId);
	if (!account) return null;
	if (!account.vtcStudentId) return [];

	const filter: Record<string, unknown> = { vtcStudentId: account.vtcStudentId };
	if (options.semester) filter.semester = options.semester;

	return Attendance.find(filter).sort({ semester: 1, courseCode: 1 }).limit(options.limit).lean();
}
