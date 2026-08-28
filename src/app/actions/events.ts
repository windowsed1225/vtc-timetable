"use server";

import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { invalidateUserCaches } from "@/lib/cache";
import connectDB from "@/lib/db";
import { loadStoredEvents, loadUniqueCourses } from "@/lib/load-user-data";
import Event, { SemesterType } from "@/models/Event";
import { CalendarEvent } from "@/types/timetable";
import { revalidatePath } from "next/cache";

/**
 * Get stored events from MongoDB for the authenticated user
 */
export async function getStoredEvents(): Promise<{
	success: boolean;
	data?: CalendarEvent[];
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: true, data: [] };
		}

		return { success: true, data: await loadStoredEvents(user) };
	} catch (error) {
		console.error("Error fetching stored events:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch events",
		};
	}
}

/**
 * Get unique courses from stored events for the authenticated user
 */
export async function getUniqueCourses(): Promise<{
	success: boolean;
	data?: Array<{ courseCode: string; courseTitle: string; colorIndex: number; semester: string; status: string }>;
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: true, data: [] };
		}

		return { success: true, data: await loadUniqueCourses(user) };
	} catch (error) {
		console.error("Error fetching unique courses:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch courses",
		};
	}
}

/**
 * Update start/end time of a specific event
 */
export async function updateEventDetails(eventId: string, newStart: Date, newEnd: Date) {
	try {
		const user = await getAuthenticatedUser();
		if (!user) return { success: false, error: "Unauthorized" };
		if (!user.vtcStudentId) return { success: false, error: "No VTC student ID found." };

		await connectDB();
		const updated = await Event.findOneAndUpdate(
			{ vtc_id: eventId, vtcStudentId: user.vtcStudentId },
			{ startTime: newStart, endTime: newEnd },
			{ returnDocument: "after" },
		);
		if (!updated) return { success: false, error: "Event not found." };

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Failed to update event" };
	}
}

/**
 * Update status of a specific event (NORMAL, CANCELED, RESCHEDULED, FINISHED)
 */
export async function setEventStatus(eventId: string, status: string) {
	try {
		const user = await getAuthenticatedUser();
		if (!user) return { success: false, error: "Unauthorized" };
		if (!user.vtcStudentId) return { success: false, error: "No VTC student ID found." };

		await connectDB();
		const updated = await Event.findOneAndUpdate(
			{ vtc_id: eventId, vtcStudentId: user.vtcStudentId },
			{ status },
			{ returnDocument: "after" },
		);
		if (!updated) return { success: false, error: "Event not found." };

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Failed to set status" };
	}
}

/**
 * Manually override the actual end time of an event (for skipping calculator accuracy).
 * Sets isTimeAdjusted = true so background syncs won't overwrite the user's change.
 */
export async function updateEventActualTimeAction(eventId: string, newEndTimeMs: number) {
	try {
		const user = await getAuthenticatedUser();
		if (!user) return { success: false, error: "Unauthorized" };
		if (!user.vtcStudentId) return { success: false, error: "No VTC student ID found." };

		await connectDB();

		const event = await Event.findOne({ vtc_id: eventId, vtcStudentId: user.vtcStudentId });
		if (!event) return { success: false, error: "Event not found." };

		const newEndTime = new Date(newEndTimeMs);
		const actualDuration = (newEndTime.getTime() - new Date(event.startTime).getTime()) / 1000 / 60;

		await Event.findOneAndUpdate(
			{ vtc_id: eventId, vtcStudentId: user.vtcStudentId },
			{ endTime: newEndTime, actualDuration, isTimeAdjusted: true },
			{ returnDocument: "after" },
		);

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Failed to update event time" };
	}
}

/**
 * Preview how many events (no attendance data) fall within a date range for a course.
 */
export async function previewDeleteEventsByDateRange(
	courseCode: string,
	semester: string,
	fromDate: Date,
	toDate: Date,
): Promise<{ success: boolean; count?: number; events?: { vtc_id: string; startTime: string; endTime: string }[]; error?: string }> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) return { success: false, error: "Unauthorized" };
		if (!user.vtcStudentId) return { success: false, error: "No VTC student ID found." };

		await connectDB();

		const events = await Event.find({
			vtcStudentId: user.vtcStudentId,
			courseCode,
			semester: semester as SemesterType,
			startTime: { $gte: fromDate, $lte: toDate },
			$or: [{ attendanceStatusCode: null }, { attendanceStatusCode: { $exists: false } }],
		})
			.select("vtc_id startTime endTime")
			.sort({ startTime: 1 })
			.lean();

		return {
			success: true,
			count: events.length,
			events: events.map((e) => ({
				vtc_id: e.vtc_id as string,
				startTime: new Date(e.startTime as Date).toISOString(),
				endTime: new Date(e.endTime as Date).toISOString(),
			})),
		};
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Failed to preview" };
	}
}

/**
 * Delete events without attendance data within a date range for a course.
 */
export async function deleteEventsByDateRange(
	courseCode: string,
	semester: string,
	fromDate: Date,
	toDate: Date,
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) return { success: false, error: "Unauthorized" };
		if (!user.vtcStudentId) return { success: false, error: "No VTC student ID found." };

		await connectDB();

		const result = await Event.deleteMany({
			vtcStudentId: user.vtcStudentId,
			courseCode,
			semester: semester as SemesterType,
			startTime: { $gte: fromDate, $lte: toDate },
			$or: [{ attendanceStatusCode: null }, { attendanceStatusCode: { $exists: false } }],
		});

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true, deletedCount: result.deletedCount };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Failed to delete events" };
	}
}

/**
 * Mark all future events of a course as FINISHED
 */
export async function finishCourseEarly(courseCode: string, semester: string) {
	try {
		const user = await getAuthenticatedUser();
		if (!user) return { success: false, error: "Unauthorized" };
		if (!user.vtcStudentId) return { success: false, error: "No VTC student ID found." };

		await connectDB();
		const now = new Date();

		await Event.updateMany(
			{
				courseCode,
				vtcStudentId: user.vtcStudentId,
				semester: semester as SemesterType,
				startTime: { $gt: now },
			},
			{ status: "FINISHED" },
		);

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Failed to finish course" };
	}
}
