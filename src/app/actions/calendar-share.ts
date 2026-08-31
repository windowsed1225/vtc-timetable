"use server";

import { auth } from "@/auth";
import { createCalendarShareToken } from "@/lib/calendar-share";
import connectDB from "@/lib/db";
import { isPlaygroundOwner } from "@/lib/vtc-playground";
import User from "@/models/User";

export type CalendarShareState = {
	success: boolean;
	enabled: boolean;
	token?: string;
	error?: string;
	ownerLookupAllowed?: boolean;
};

async function getOwnerDiscordId(): Promise<string | null> {
	const session = await auth();
	return session?.user?.discordId ?? null;
}

export async function getCalendarShareState(): Promise<CalendarShareState> {
	const discordId = await getOwnerDiscordId();
	if (!discordId) return { success: false, enabled: false, error: "Not authenticated" };

	try {
		await connectDB();
		const user = await User.findOne({ discordId }).select("calendarShareToken").lean();
		if (!user) return { success: false, enabled: false, error: "User not found" };

		return {
			success: true,
			enabled: Boolean(user.calendarShareToken),
			token: user.calendarShareToken || undefined,
			ownerLookupAllowed: isPlaygroundOwner(discordId),
		};
	} catch {
		return { success: false, enabled: false, error: "Could not load calendar sharing" };
	}
}

async function writeCalendarShareToken(regenerate: boolean): Promise<CalendarShareState> {
	const discordId = await getOwnerDiscordId();
	if (!discordId) return { success: false, enabled: false, error: "Not authenticated" };

	try {
		await connectDB();
		const user = await User.findOne({ discordId })
			.select("vtcStudentId calendarShareToken")
			.lean();
		if (!user?.vtcStudentId) {
			return {
				success: false,
				enabled: false,
				error: "Sync your VTC timetable before sharing it.",
				ownerLookupAllowed: isPlaygroundOwner(discordId),
			};
		}

		const token = !regenerate && user.calendarShareToken
			? user.calendarShareToken
			: createCalendarShareToken();
		await User.updateOne({ discordId }, { $set: { calendarShareToken: token } });

		return { success: true, enabled: true, token, ownerLookupAllowed: isPlaygroundOwner(discordId) };
	} catch {
		return { success: false, enabled: false, error: "Could not update calendar sharing" };
	}
}

export async function enableCalendarShare(): Promise<CalendarShareState> {
	return writeCalendarShareToken(false);
}

export async function regenerateCalendarShare(): Promise<CalendarShareState> {
	return writeCalendarShareToken(true);
}

export async function disableCalendarShare(): Promise<CalendarShareState> {
	const discordId = await getOwnerDiscordId();
	if (!discordId) return { success: false, enabled: false, error: "Not authenticated" };

	try {
		await connectDB();
		await User.updateOne({ discordId }, { $unset: { calendarShareToken: "" } });
		return { success: true, enabled: false, ownerLookupAllowed: isPlaygroundOwner(discordId) };
	} catch {
		return { success: false, enabled: false, error: "Could not update calendar sharing" };
	}
}
