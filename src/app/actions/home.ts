"use server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { DEFAULT_GRACE_PERIOD_THRESHOLD } from "@/lib/grace-period";
import {
	loadHybridAttendance,
	loadMoodleDeadlines,
	loadStoredEvents,
	loadUniqueCourses,
	type UniqueCourse,
} from "@/lib/load-user-data";
import type { HybridAttendanceStats } from "./types";
import type { CalendarEvent } from "@/types/timetable";

export type AuthenticatedHomeData = {
	events: CalendarEvent[];
	courses: UniqueCourse[];
	attendance: HybridAttendanceStats[];
	gracePeriodThreshold: number;
};

export async function getAuthenticatedHomeData(): Promise<{
	success: boolean;
	data?: AuthenticatedHomeData;
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return {
				success: true,
				data: { events: [], courses: [], attendance: [], gracePeriodThreshold: DEFAULT_GRACE_PERIOD_THRESHOLD },
			};
		}

		const [classEvents, courses, attendance, moodleEvents] = await Promise.all([
			loadStoredEvents(user),
			loadUniqueCourses(user),
			loadHybridAttendance(user),
			loadMoodleDeadlines(user),
		]);

		return {
			success: true,
			data: {
				events: [...classEvents, ...moodleEvents],
				courses,
				attendance,
				gracePeriodThreshold: user.gracePeriodThreshold,
			},
		};
	} catch (error) {
		console.error("Error loading authenticated home data:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to load timetable data",
		};
	}
}
