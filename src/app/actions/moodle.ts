"use server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { loadMoodleDeadlines } from "@/lib/load-user-data";
import { CalendarEvent } from "@/types/timetable";

/**
 * Fetch Moodle deadlines from VTC API using stored token.
 * Returns CalendarEvent[] with eventType "deadline" and actionUrl for redirect.
 * Non-fatal — returns empty array on any failure so it doesn't break the calendar.
 */
export async function getMoodleDeadlines(): Promise<{
	success: boolean;
	data?: CalendarEvent[];
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) return { success: true, data: [] };
		return { success: true, data: await loadMoodleDeadlines(user) };
	} catch (error) {
		console.error("Error fetching Moodle deadlines:", error);
		return { success: true, data: [] };
	}
}
