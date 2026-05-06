"use server";

import { auth } from "@/auth";
import connectDB from "@/lib/db";
import { IEvent } from "@/models/Event";
import Event from "@/models/Event";
import User from "@/models/User";

/**
 * Export semester-specific events as ICS string.
 * Looks up user's vtcStudentId first, then queries events by that ID.
 */
export async function exportSemesterIcs(semester: string): Promise<{
	success: boolean;
	data?: string;
	eventCount?: number;
	error?: string;
}> {
	try {
		// Step 1: Auth Check
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Please sign in first." };
		}

		// Step 2: Validate semester
		const validSemesters = ["SEM 1", "SEM 2", "SEM 3"];
		if (!validSemesters.includes(semester)) {
			return { success: false, error: "Invalid semester. Use 'SEM 1', 'SEM 2', or 'SEM 3'." };
		}

		// Step 3: Get vtcStudentId from User
		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();
		if (!user?.vtcStudentId) {
			return { success: false, error: "No VTC student ID found. Please sync your schedule first." };
		}

		// Step 4: Fetch events by vtcStudentId (not discordId — events don't have discordId)
		const events = await Event.find({ vtcStudentId: user.vtcStudentId, semester }).sort({ startTime: 1 }).lean();

		if (events.length === 0) {
			return { success: false, error: `No events found for ${semester}. Try syncing your schedule first.` };
		}

		// Step 5: Generate ICS string
		const { createEvents } = await import("ics");
		type EventAttributes = import("ics").EventAttributes;

		const getDateArray = (date: Date): [number, number, number, number, number] => [
			date.getFullYear(),
			date.getMonth() + 1,
			date.getDate(),
			date.getHours(),
			date.getMinutes(),
		];

		const icsEvents: EventAttributes[] = (events as IEvent[]).map((event) => ({
			uid: `${event.vtc_id}@vtc-timetable`,
			title: `${event.courseTitle} (${event.courseCode})`,
			start: getDateArray(new Date(event.startTime)),
			end: getDateArray(new Date(event.endTime)),
			location: event.location || undefined,
			description: [event.lessonType ? `Type: ${event.lessonType}` : "", event.lecturerName ? `Lecturer: ${event.lecturerName}` : "", `Semester: ${event.semester}`].filter(Boolean).join("\n"),
			categories: [event.courseCode, event.semester],
		}));

		const { error, value } = createEvents(icsEvents);

		if (error || !value) {
			console.error("Error generating ICS:", error);
			return { success: false, error: "Failed to generate calendar file." };
		}

		return { success: true, data: value, eventCount: events.length };
	} catch (error) {
		console.error("Error exporting semester ICS:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to export calendar",
		};
	}
}
