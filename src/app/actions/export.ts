"use server";

import { auth } from "@/auth";
import connectDB from "@/lib/db";
import { normalizeSemester, semesterTag } from "@/lib/semester";
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
		const semesterNum = normalizeSemester(semester);
		if (!semesterNum) {
			return { success: false, error: "Invalid semester." };
		}

		// Step 3: Get vtcStudentId from User
		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();
		if (!user?.vtcStudentId) {
			return { success: false, error: "No VTC student ID found. Please sync your schedule first." };
		}

		// Step 4: Fetch events by vtcStudentId (not discordId — events don't have discordId)
		const events = await Event.find({
			vtcStudentId: user.vtcStudentId,
			semester: { $in: [semesterNum, semesterTag(semesterNum)] },
		})
			.sort({ startTime: 1 })
			.lean();

		if (events.length === 0) {
			return { success: false, error: `No events found for ${semester}. Try syncing your schedule first.` };
		}

		// Step 5: Generate ICS string
		const { createEvents } = await import("ics");
		const { eventToIcsAttributes } = await import("@/lib/calendar-ics");
		const icsEvents = (events as IEvent[]).map((event) => eventToIcsAttributes(event));

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
