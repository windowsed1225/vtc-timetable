import { cache } from "react";
import {
	calendarShareRange,
	isValidDiscordId,
	isValidCalendarShareToken,
	toSharedCalendarEvents,
	type CalendarShareView,
	type SharedCalendarEvent,
} from "@/lib/calendar-share";
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

async function loadCalendarForUser(
	user: { vtcStudentId?: string | null; locale?: string | null } | null,
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

export const loadSharedCalendar = cache(async (
	token: string,
	view: CalendarShareView,
	month: string | null = null,
): Promise<SharedCalendar | null> => {
	if (!isValidCalendarShareToken(token)) return null;

	await connectDB();
	const user = await User.findOne({ calendarShareToken: token })
		.select("vtcStudentId locale")
		.lean();
	return loadCalendarForUser(user, view, month);
});

export const loadOwnerCalendar = cache(async (
	discordId: string,
	view: CalendarShareView,
	requesterDiscordId: string,
	month: string | null = null,
): Promise<SharedCalendar | null> => {
	if (!isPlaygroundOwner(requesterDiscordId) || !isValidDiscordId(discordId)) return null;

	await connectDB();
	const user = await User.findOne({ discordId })
		.select("vtcStudentId locale")
		.lean();
	return loadCalendarForUser(user, view, month);
});
