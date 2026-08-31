import { cache } from "react";
import {
	calendarShareRange,
	isValidDiscordId,
	isValidCalendarShareToken,
	toSharedCalendarEvents,
	type CalendarShareView,
	type SharedCalendarEvent,
} from "@/lib/calendar-share";
import { cacheAside, getSharedCalendarCacheVersion } from "@/lib/cache";
import { CACHE_TTL_SECONDS, sharedCalendarCacheKey } from "@/lib/cache-policy";
import connectDB from "@/lib/db";
import Event from "@/models/Event";
import User from "@/models/User";
import { isPlaygroundOwner } from "@/lib/vtc-playground";

export type SharedCalendar = {
	locale: "en" | "zh-HK";
	view: CalendarShareView;
	month: string | null;
	events: SharedCalendarEvent[];
};

type ShareOwner = { vtcStudentId?: string | null; locale?: string | null } | null;

async function loadCalendarForUser(
	user: ShareOwner,
	view: CalendarShareView,
	month: string | null,
): Promise<SharedCalendar | null> {
	if (!user?.vtcStudentId) return null;

	const now = new Date();
	const range = calendarShareRange(view, now, month);
	const events = await Event.find({
		vtcStudentId: user.vtcStudentId,
		endTime: { $gte: range.start },
		startTime: { $lt: range.end },
		status: { $ne: "CANCELED" },
	})
		.select({
			courseCode: 1,
			courseTitle: 1,
			lessonType: 1,
			startTime: 1,
			endTime: 1,
			location: 1,
			colorIndex: 1,
			status: 1,
		})
		.sort({ startTime: 1 })
		.lean();

	return {
		locale: user.locale === "zh-HK" ? "zh-HK" : "en",
		view,
		month,
		events: toSharedCalendarEvents(events, now, view, month),
	};
}

/**
 * Serves a share from Redis when it is configured, so a link that Discord and its
 * readers hit repeatedly does not reach MongoDB at all. Without Redis this is a
 * plain pass-through to the database.
 */
async function loadCachedCalendar(
	scope: string,
	view: CalendarShareView,
	month: string | null,
	findOwner: () => Promise<ShareOwner>,
): Promise<SharedCalendar | null> {
	const range = calendarShareRange(view, new Date(), month);
	const version = await getSharedCalendarCacheVersion(scope);
	const key = sharedCalendarCacheKey(scope, version, view, range.start.getTime());

	return cacheAside(key, CACHE_TTL_SECONDS.sharedCalendar, async () => {
		await connectDB();
		return loadCalendarForUser(await findOwner(), view, month);
	});
}

export const loadSharedCalendar = cache(async (
	token: string,
	view: CalendarShareView,
	month: string | null = null,
): Promise<SharedCalendar | null> => {
	if (!isValidCalendarShareToken(token)) return null;

	return loadCachedCalendar(token, view, month, () => User
		.findOne({ calendarShareToken: token })
		.select("vtcStudentId locale")
		.lean());
});

export const loadOwnerCalendar = cache(async (
	discordId: string,
	view: CalendarShareView,
	requesterDiscordId: string,
	month: string | null = null,
): Promise<SharedCalendar | null> => {
	if (!isPlaygroundOwner(requesterDiscordId) || !isValidDiscordId(discordId)) return null;

	return loadCachedCalendar(`owner:${discordId}`, view, month, () => User
		.findOne({ discordId })
		.select("vtcStudentId locale")
		.lean());
});
