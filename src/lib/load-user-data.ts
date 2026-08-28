import type { AuthenticatedUser } from "@/lib/authenticated-user";
import { cacheAside, getUserCacheVersion } from "@/lib/cache";
import {
	CACHE_TTL_SECONDS,
	attendanceCacheKey,
	courseHoursCacheKey,
	coursesCacheKey,
	moodleCacheKey,
	printQuotaCacheKey,
	programmeCacheKey,
	timetableCacheKey,
} from "@/lib/cache-policy";
import connectDB from "@/lib/db";
import { APP_TIME_ZONE } from "@/lib/event-date";
import { buildHybridAttendanceStats } from "@/lib/hybrid-attendance";
import { getDurationInMinutes, isAttendanceStatusPresent } from "@/app/actions/_helpers";
import type { AttendanceStats, HybridAttendanceStats } from "@/app/actions/types";
import Attendance from "@/models/Attendance";
import Event from "@/models/Event";
import { CalendarEvent, EventStatusType, SemesterType } from "@/types/timetable";
import { API } from "../../vtc-api/src/core/api";
import type { PrintQuotaPayload } from "../../vtc-api/src/types/getPrintQuota";

const EVENT_CALENDAR_PROJECTION = {
	courseCode: 1,
	courseTitle: 1,
	lessonType: 1,
	startTime: 1,
	endTime: 1,
	location: 1,
	lecturerName: 1,
	colorIndex: 1,
	semester: 1,
	status: 1,
	vtc_id: 1,
	actualDuration: 1,
	scheduledDuration: 1,
	isTimeAdjusted: 1,
	attendanceStatusCode: 1,
} as const;

const EVENT_HYBRID_PROJECTION = {
	courseCode: 1,
	semester: 1,
	status: 1,
	startTime: 1,
	endTime: 1,
	actualDuration: 1,
	attendanceStatusCode: 1,
} as const;

const ATTENDANCE_PROJECTION = {
	courseCode: 1,
	courseName: 1,
	semester: 1,
	status: 1,
	attendRate: 1,
	totalClasses: 1,
	conductedClasses: 1,
	attended: 1,
	late: 1,
	absent: 1,
	isFinished: 1,
	isFollowUp: 1,
	baseCourseCode: 1,
	classes: 1,
} as const;

export function reviveCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
	return events.map((event) => ({
		...event,
		start: event.start instanceof Date ? event.start : new Date(event.start),
		end: event.end instanceof Date ? event.end : new Date(event.end),
	}));
}

function mapStoredEvents(
	events: Array<{
		courseTitle: string;
		startTime: Date;
		endTime: Date;
		courseCode: string;
		location?: string;
		lessonType?: string;
		lecturerName?: string;
		colorIndex?: number;
		semester: string;
		status: string;
		vtc_id: string;
		actualDuration?: number;
		scheduledDuration?: number;
		isTimeAdjusted?: boolean;
		attendanceStatusCode?: number | null;
	}>,
): CalendarEvent[] {
	return events.map((event) => ({
		title: `${event.courseTitle}`,
		start: new Date(event.startTime),
		end: new Date(event.endTime),
		resource: {
			courseCode: event.courseCode,
			courseTitle: event.courseTitle,
			location: event.location,
			lessonType: event.lessonType,
			lecturer: event.lecturerName,
			colorIndex: event.colorIndex,
			semester: event.semester as SemesterType,
			status: event.status as EventStatusType,
			vtc_id: event.vtc_id,
			actualDuration: event.actualDuration,
			scheduledDuration: event.scheduledDuration,
			isAdjusted: Boolean(event.isTimeAdjusted),
			attendanceStatusCode: event.attendanceStatusCode ?? null,
		},
	}));
}

export async function loadStoredEvents(user: AuthenticatedUser): Promise<CalendarEvent[]> {
	if (!user.vtcStudentId) return [];
	await connectDB();
	const cacheVersion = await getUserCacheVersion(user.userId);
	const cached = await cacheAside(timetableCacheKey(user.userId, cacheVersion), CACHE_TTL_SECONDS.timetable, async () => {
		const events = await Event.find({ vtcStudentId: user.vtcStudentId })
			.select(EVENT_CALENDAR_PROJECTION)
			.sort({ startTime: 1 })
			.lean();
		return mapStoredEvents(events);
	});
	return reviveCalendarEvents(cached);
}

export type UniqueCourse = {
	courseCode: string;
	courseTitle: string;
	colorIndex: number;
	semester: string;
	status: string;
};

export async function loadUniqueCourses(user: AuthenticatedUser): Promise<UniqueCourse[]> {
	if (!user.vtcStudentId) return [];
	await connectDB();
	const cacheVersion = await getUserCacheVersion(user.userId);
	return cacheAside(coursesCacheKey(user.userId, cacheVersion), CACHE_TTL_SECONDS.courses, async () => {
		return Event.aggregate<UniqueCourse>([
			{ $match: { vtcStudentId: user.vtcStudentId } },
			{
				$group: {
					_id: { courseCode: "$courseCode", semester: "$semester" },
					courseTitle: { $first: "$courseTitle" },
					colorIndex: { $first: "$colorIndex" },
					status: { $first: "$status" },
				},
			},
			{
				$project: {
					_id: 0,
					courseCode: "$_id.courseCode",
					semester: "$_id.semester",
					courseTitle: 1,
					colorIndex: 1,
					status: 1,
				},
			},
			{ $sort: { semester: -1, courseCode: 1 } },
		]);
	});
}

export async function loadHybridAttendance(user: AuthenticatedUser): Promise<HybridAttendanceStats[]> {
	if (!user.vtcStudentId) return [];
	await connectDB();
	const cacheVersion = await getUserCacheVersion(user.userId);
	return cacheAside(
		attendanceCacheKey(user.userId, cacheVersion, user.gracePeriodThreshold),
		CACHE_TTL_SECONDS.attendance,
		async () => {
			const attendanceRecords = await Attendance.find({ vtcStudentId: user.vtcStudentId })
				.select(ATTENDANCE_PROJECTION)
				.sort({ courseCode: 1 })
				.lean();

			const allCourseCodes = new Set<string>();
			for (const record of attendanceRecords) {
				allCourseCodes.add(record.courseCode);
				if (record.baseCourseCode) allCourseCodes.add(record.baseCourseCode);
			}

			const allCalendarEvents =
				allCourseCodes.size === 0
					? []
					: await Event.find({
							vtcStudentId: user.vtcStudentId,
							courseCode: { $in: Array.from(allCourseCodes) },
							status: { $ne: "CANCELED" },
						})
							.select(EVENT_HYBRID_PROJECTION)
							.lean();

			return buildHybridAttendanceStats(attendanceRecords, allCalendarEvents, new Date(), user.gracePeriodThreshold);
		},
	);
}

export async function loadStoredAttendance(user: AuthenticatedUser): Promise<AttendanceStats[]> {
	const hybrid = await loadHybridAttendance(user);
	return hybrid.map((record) => ({
		courseCode: record.courseCode,
		courseName: record.courseName,
		semester: record.semester,
		status: record.status,
		attendRate: record.attendRate,
		totalClasses: record.totalClasses,
		conductedClasses: record.conductedClasses,
		attended: record.attended,
		late: record.late,
		absent: record.absent,
		isLow: record.isLow,
		isFinished: record.isFinished,
		isFollowUp: record.isFollowUp,
		baseCourseCode: record.baseCourseCode,
		classes: record.classes,
		gracePeriodThreshold: record.gracePeriodThreshold,
	}));
}

export async function loadMoodleDeadlines(user: AuthenticatedUser): Promise<CalendarEvent[]> {
	if (!user.vtcToken) return [];
	const now = new Date();
	const month = now.getMonth() + 1;
	const year = now.getFullYear();
	const cacheVersion = await getUserCacheVersion(user.userId);
	const cached = await cacheAside(
		moodleCacheKey(user.userId, cacheVersion, year, month),
		CACHE_TTL_SECONDS.moodle,
		async () => {
			const api = new API({ token: user.vtcToken! });
			const nextMonth = month === 12 ? 1 : month + 1;
			const nextYear = month === 12 ? year + 1 : year;
			const [res1, res2] = await Promise.all([
				api.getMoodleTimetable(1, month, year),
				api.getMoodleTimetable(1, nextMonth, nextYear),
			]);

			const seen = new Set<number>();
			const allItems = [
				...(res1.isSuccess ? res1.payload ?? [] : []),
				...(res2.isSuccess ? res2.payload ?? [] : []),
			].filter((item) => {
				if (seen.has(item.id)) return false;
				seen.add(item.id);
				return true;
			});

			return allItems.map((item) => {
				const start = new Date(item.timeStart * 1000);
				const end =
					item.timeEnd && item.timeEnd > item.timeStart
						? new Date(item.timeEnd * 1000)
						: new Date(start.getTime() + 60 * 60 * 1000);

				return {
					title: item.name,
					start,
					end,
					resource: {
						courseCode: item.courseShortName,
						courseTitle: item.courseFullName,
						eventType: "deadline" as const,
						actionUrl: item.actionUrl,
						courseUrl: item.courseUrl,
					},
				} satisfies CalendarEvent;
			});
		},
	);
	return reviveCalendarEvents(cached);
}

export async function loadPrintQuota(user: AuthenticatedUser): Promise<PrintQuotaPayload | null> {
	if (!user.vtcToken) return null;
	const cacheVersion = await getUserCacheVersion(user.userId);
	return cacheAside(printQuotaCacheKey(user.userId, cacheVersion), CACHE_TTL_SECONDS.printQuota, async () => {
		const api = new API({ token: user.vtcToken! });
		const result = await api.getPrintQuota();
		if (!result.isSuccess || !result.payload) {
			throw new Error("print-quota-unavailable");
		}
		return {
			campus: result.payload.campus,
			balance: result.payload.balance,
			status: result.payload.status,
			lastUpdatedTime: result.payload.lastUpdatedTime,
		};
	});
}

export type ProgrammeInfo = {
	progStructCode: string;
	progStructCodeDesc: string;
};

export async function loadProgrammeInfo(user: AuthenticatedUser): Promise<ProgrammeInfo | null> {
	if (!user.vtcToken) return null;
	const cacheVersion = await getUserCacheVersion(user.userId);
	return cacheAside(programmeCacheKey(user.userId, cacheVersion), CACHE_TTL_SECONDS.programme, async () => {
		const api = new API({ token: user.vtcToken! });
		const result = await api.registerEcard();
		if (!result.isSuccess || !result.payload?.userInfo) {
			throw new Error("programme-unavailable");
		}
		const { progStructCode, progStructCodeDesc } = result.payload.userInfo;
		if (!progStructCode && !progStructCodeDesc) return null;
		return {
			progStructCode: progStructCode || "",
			progStructCodeDesc: progStructCodeDesc || "",
		};
	});
}

export async function loadCourseHoursBreakdown(
	user: AuthenticatedUser,
	courseCode: string,
): Promise<{ courseName?: string; totalMinutes: number; days: Array<{ date: string; minutes: number }> }> {
	if (!user.vtcStudentId) return { totalMinutes: 0, days: [] };
	await connectDB();
	const cacheVersion = await getUserCacheVersion(user.userId);
	return cacheAside(
		courseHoursCacheKey(user.userId, cacheVersion, courseCode),
		CACHE_TTL_SECONDS.courseHours,
		async () => {
			const events = await Event.find({ vtcStudentId: user.vtcStudentId, courseCode })
				.select({ courseTitle: 1, startTime: 1, endTime: 1, actualDuration: 1, attendanceStatusCode: 1 })
				.lean();
			const now = new Date();
			const dayFormatter = new Intl.DateTimeFormat("en-CA", {
				timeZone: APP_TIME_ZONE,
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			});

			const byDay = new Map<string, number>();
			let totalMinutes = 0;
			let courseName: string | undefined;

			for (const event of events) {
				courseName = courseName ?? event.courseTitle;
				const startTime = new Date(event.startTime);
				const endTime = new Date(event.endTime);
				if (endTime >= now) continue;
				if (!isAttendanceStatusPresent(event.attendanceStatusCode)) continue;
				const durationMinutes =
					typeof event.actualDuration === "number" && event.actualDuration > 0
						? event.actualDuration
						: getDurationInMinutes(startTime, endTime);
				const dayKey = dayFormatter.format(startTime);
				byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + durationMinutes);
				totalMinutes += durationMinutes;
			}

			const days = Array.from(byDay.entries())
				.map(([date, minutes]) => ({ date, minutes: Math.round(minutes) }))
				.sort((a, b) => a.date.localeCompare(b.date));

			return { courseName, totalMinutes: Math.round(totalMinutes), days };
		},
	);
}
