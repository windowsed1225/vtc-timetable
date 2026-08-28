"use server";

import { Types } from "mongoose";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { invalidateUserCaches } from "@/lib/cache";
import { DEFAULT_GRACE_PERIOD_THRESHOLD } from "@/lib/grace-period";
import { loadCourseHoursBreakdown, loadHybridAttendance, loadStoredAttendance } from "@/lib/load-user-data";
import { getCurrentSemester, getSemesterLabel } from "@/lib/utils";
import Attendance, { IClassRecord } from "@/models/Attendance";
import Event from "@/models/Event";
import { revalidatePath } from "next/cache";
import { API } from "../../../vtc-api/src/core/api";
import { buildCompositeEventId, getAttendancePresence, parseVtcLessonTime } from "./_helpers";
import type { AttendanceStats, ClassRecord, HybridAttendanceStats } from "./types";

/**
 * Refresh attendance from VTC API using stored token
 * Fetches fresh data and updates the database
 */
export async function refreshAttendance(): Promise<{
	success: boolean;
	error?: string;
	updatedCount?: number;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: false, error: "Please sign in first." };
		}
		if (!user.vtcToken) {
			return { success: false, error: "No VTC token stored. Please sync your schedule first." };
		}

		const vtcStudentId = user.vtcStudentId || "";
		const api = new API({ token: user.vtcToken });

		// Step 3: Fetch and update attendance
		const listResponse = await api.getClassAttendanceList();

		if (!listResponse.isSuccess) {
			return { success: false, error: "Failed to fetch attendance. Token may be expired." };
		}

		const courses = listResponse.payload?.courses || [];
		let updatedCount = 0;

		const attendanceOps = await Promise.all(
			courses.map(async (course) => {
				const detailResponse = await api.getClassAttendanceDetail(course.courseCode);

				let attended = 0;
				let late = 0;
				let absent = 0;
				let totalConducted = 0;
				const classRecords: IClassRecord[] = [];

				if (detailResponse.isSuccess && detailResponse.payload?.classes) {
					for (const cls of detailResponse.payload.classes) {
						const parsedTime = parseVtcLessonTime(cls.date, cls.lessonTime);
						const status = getAttendancePresence(cls);
						const classId = parsedTime
							? buildCompositeEventId(course.courseCode, parsedTime.start, parsedTime.end)
							: cls.id;

						totalConducted++;
						if (status === "absent") {
							absent++;
						} else if (status === "late") {
							late++;
							attended++;
						} else {
							attended++;
						}

						classRecords.push({
							id: classId,
							date: cls.date,
							lessonTime: cls.lessonTime,
							attendTime: cls.attendTime,
							roomName: cls.roomName,
							actualDuration: parsedTime?.duration,
							status,
						});
					}
				}

				const totalScheduled = detailResponse.payload?.totalNumOfClass || 0;
				const attendRate = totalConducted > 0 ? (attended / totalConducted) * 100 : 0;
				const isFollowUp = /A$/.test(course.courseCode);
				const baseCourseCode = isFollowUp ? course.courseCode.slice(0, -1) : course.courseCode;

				// Determine semester from earliest class date
				let semester: "SEM 1" | "SEM 2" | "SEM 3" = getSemesterLabel(getCurrentSemester());
				if (classRecords.length > 0) {
					const earliestDate = classRecords[0].date; // Already sorted by VTC API
					const dateParts = earliestDate.split("/");
					if (dateParts.length === 3) {
						const month = parseInt(dateParts[1], 10);
						if (month >= 9 && month <= 12) {
							semester = "SEM 1";
						} else if (month >= 1 && month <= 4) {
							semester = "SEM 2";
						} else if (month >= 5 && month <= 8) {
							semester = "SEM 3";
						}
					}
				}

				return {
					updateOne: {
						filter: { courseCode: course.courseCode, vtcStudentId, semester },
						update: {
							$set: {
								vtcStudentId,
								semester,
								courseCode: course.courseCode,
								courseName: course.name?.en || course.courseCode,
								attendRate: Math.round(attendRate * 10) / 10,
								totalClasses: totalScheduled,
								conductedClasses: totalConducted,
								attended,
								late,
								absent,
								isFinished: totalScheduled > 0 && totalConducted >= totalScheduled,
								isFollowUp,
								baseCourseCode,
								classes: classRecords,
							},
						},
						upsert: true,
					},
				};
			}),
		);

		if (attendanceOps.length > 0) {
			const result = await Attendance.bulkWrite(attendanceOps);
			updatedCount = result.modifiedCount + result.upsertedCount;
		}

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true, updatedCount };
	} catch (error) {
		console.error("Error refreshing attendance:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to refresh attendance",
		};
	}
}

/**
 * Toggle manual attendance status for an event
 * Sets status to ABSENT or restores to UPCOMING
 * For follow-up courses (ending with A), also syncs to Attendance.classes
 */
export async function toggleEventAttendance(vtcId: string, status: "UPCOMING" | "ABSENT"): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: false, error: "Please sign in first." };
		}
		if (!user.vtcStudentId) {
			return { success: false, error: "No VTC student ID found. Please sync your schedule first." };
		}
		const vtcStudentId = user.vtcStudentId;

		// Update Event model status field
		const event = await Event.findOneAndUpdate({ vtc_id: vtcId, vtcStudentId }, { status: status }, { returnDocument: 'after' });

		if (!event) {
			return { success: false, error: "Event not found." };
		}

		// For follow-up courses (ending with A), also sync to Attendance
		const isFollowUp = /A$/.test(event.courseCode);
		if (isFollowUp) {
			const attendanceStatus = status === "ABSENT" ? "absent" : "attended";
			const eventDate = new Date(event.startTime);
			const dateStr = eventDate.toISOString().split("T")[0]; // YYYY-MM-DD
			const startHour = eventDate.getHours().toString().padStart(2, "0");
			const startMin = eventDate.getMinutes().toString().padStart(2, "0");
			const endDate = new Date(event.endTime);
			const endHour = endDate.getHours().toString().padStart(2, "0");
			const endMin = endDate.getMinutes().toString().padStart(2, "0");
			const lessonTime = `${startHour}:${startMin} - ${endHour}:${endMin}`;

			// Check if Attendance record exists
			let attendance = await Attendance.findOne({
				courseCode: event.courseCode,
				vtcStudentId,
			});

			// If no Attendance record exists, create one (for courses without VTC data)
			if (!attendance) {
				attendance = new Attendance({
					vtcStudentId,
					semester: event.semester,
					status: "ACTIVE",
					courseCode: event.courseCode,
					courseName: event.courseTitle,
					attendRate: 0,
					totalClasses: 0,
					conductedClasses: 0,
					attended: 0,
					late: 0,
					absent: 0,
					isFinished: false,
					isFollowUp: true,
					baseCourseCode: event.courseCode.slice(0, -1),
					classes: [],
				});
			}

			// Check if this class already exists in the array
			const existingClassIndex = attendance.classes.findIndex((cls) => cls.id === vtcId);

			if (existingClassIndex >= 0) {
				// Update existing class record
				attendance.classes[existingClassIndex].status = attendanceStatus;
				attendance.classes[existingClassIndex].attendTime = "MANUAL";
			} else {
				// Add new class record
				attendance.classes.push({
					id: vtcId,
					date: dateStr,
					lessonTime,
					attendTime: "MANUAL",
					roomName: event.location || "",
					status: attendanceStatus,
				});
			}

			// Recalculate counts
			let attended = 0,
				late = 0,
				absent = 0;
			for (const cls of attendance.classes) {
				if (cls.status === "attended") attended++;
				else if (cls.status === "late") {
					late++;
					attended++;
				} else if (cls.status === "absent") absent++;
			}

			attendance.attended = attended;
			attendance.late = late;
			attendance.absent = absent;
			attendance.conductedClasses = attendance.classes.length;
			attendance.attendRate = attendance.conductedClasses > 0 ? Math.round((attended / attendance.conductedClasses) * 1000) / 10 : 0;

			await attendance.save();
		}

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true };
	} catch (error) {
		console.error("Error toggling attendance:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update attendance",
		};
	}
}

/**
 * Get stored attendance from MongoDB for the authenticated user
 */
export async function getStoredAttendance(): Promise<{
	success: boolean;
	data?: AttendanceStats[];
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: true, data: [] };
		}

		return { success: true, data: await loadStoredAttendance(user) };
	} catch (error) {
		console.error("Error fetching stored attendance:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch attendance",
		};
	}
}

/**
 * Get hybrid attendance stats - combines Attendance API data with Calendar DB data
 * This gives us accurate totals including future classes
 */
export async function getHybridAttendanceStats(): Promise<{
	success: boolean;
	data?: HybridAttendanceStats[];
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: true, data: [] };
		}

		return { success: true, data: await loadHybridAttendance(user) };
	} catch (error) {
		console.error("Error fetching hybrid attendance stats:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch hybrid attendance",
		};
	}
}


/**
 * Get attendance data from VTC API (real-time)
 * Calculates attendance from class details:
 * - status 1 = attended
 * - status 3 = late (counts as attended)
 * - attendTime "-" = absent
 */
export async function getAttendance(vtcUrl: string): Promise<{
	success: boolean;
	data?: AttendanceStats[];
	error?: string;
}> {
	try {
		const { extractToken } = await import("./_helpers");
		const token = extractToken(vtcUrl);
		if (!token) {
			return { success: false, error: "Invalid URL. No token found." };
		}

		const api = new API({ token });

		// Get the list of courses with attendance
		const listResponse = await api.getClassAttendanceList();

		if (!listResponse.isSuccess) {
			return { success: false, error: "Failed to fetch attendance list" };
		}

		const signedIn = await getAuthenticatedUser();
		const threshold = signedIn?.gracePeriodThreshold ?? DEFAULT_GRACE_PERIOD_THRESHOLD;
		const courses = listResponse.payload?.courses || [];
		const defaultSemester = getSemesterLabel(getCurrentSemester());

		const attendanceStats: AttendanceStats[] = await Promise.all(
			courses.map(async (course) => {
				// Get detailed attendance for each course
				const detailResponse = await api.getClassAttendanceDetail(course.courseCode);

				let attended = 0;
				let late = 0;
				let absent = 0;
				let totalConducted = 0;
				let calculatedRate = 0;
				const classRecords: ClassRecord[] = [];

				if (detailResponse.isSuccess && detailResponse.payload?.classes && detailResponse.payload.classes.length > 0) {
					const classes = detailResponse.payload.classes;

					for (const cls of classes) {
						const parsedTime = parseVtcLessonTime(cls.date, cls.lessonTime);
						const status = getAttendancePresence(cls);
						const classId = parsedTime
							? buildCompositeEventId(course.courseCode, parsedTime.start, parsedTime.end)
							: cls.id;

						totalConducted++;
						if (status === "absent") {
							absent++;
						} else if (status === "late") {
							late++;
							attended++;
						} else {
							attended++;
						}

						classRecords.push({
							id: classId,
							date: cls.date,
							lessonTime: cls.lessonTime,
							attendTime: cls.attendTime,
							roomName: cls.roomName,
							actualDuration: parsedTime?.duration,
							status,
						});
					}

					// Calculate attendance rate (attended) / total * 100
					calculatedRate = totalConducted > 0 ? (attended / totalConducted) * 100 : 0;
				} else {
					// Fallback to API-provided rate if no class details
					calculatedRate = course.attendRate || 0;
					totalConducted = detailResponse.payload?.totalNumOfClass || 0;
				}

				// Get total scheduled classes
				const totalScheduled = detailResponse.payload?.totalNumOfClass || 0;

				// Check if course is finished (all scheduled classes have been conducted)
				const isFinished = totalScheduled > 0 && totalConducted >= totalScheduled;

				// Check if this is a follow-up course (ends with 'A')
				const isFollowUp = /[A-Z]$/.test(course.courseCode) && course.courseCode.match(/[A-Z]$/)?.[0] === "A";
				const baseCourseCode = isFollowUp ? course.courseCode.slice(0, -1) : course.courseCode;

				// Ensure we have valid numbers
				const finalRate = isNaN(calculatedRate) ? course.attendRate || 0 : calculatedRate;

				return {
					courseCode: course.courseCode,
					courseName: course.name?.en || course.courseCode,
					semester: defaultSemester,
					status: isFinished ? "FINISHED" : "ACTIVE",
					attendRate: Math.round(finalRate * 10) / 10, // Round to 1 decimal
					totalClasses: totalScheduled || 0,
					conductedClasses: totalConducted || 0,
					attended: attended || 0,
					late: late || 0,
					absent: absent || 0,
					isLow: finalRate < threshold,
					gracePeriodThreshold: threshold,
					isFinished,
					isFollowUp,
					baseCourseCode,
					classes: classRecords,
				};
			}),
		);

		return { success: true, data: attendanceStats };
	} catch (error) {
		console.error("Error fetching attendance:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch attendance",
		};
	}
}

/**
 * Deduplicate events and attendance data
 * Removes duplicate records keeping only the most recently updated version
 */
export async function deduplicateData(): Promise<{
	success: boolean;
	error?: string;
	deletedEvents?: number;
	deletedAttendance?: number;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: false, error: "Please sign in first." };
		}
		if (!user.vtcStudentId) {
			return { success: false, error: "No VTC student ID found. Please sync your schedule first." };
		}
		const vtcStudentId = user.vtcStudentId;

		// Deduplicate Events - group by unique key and keep the newest
		const eventDuplicates = await Event.aggregate([
			{ $match: { vtcStudentId } },
			{
				$group: {
					_id: { vtc_id: "$vtc_id", vtcStudentId: "$vtcStudentId", semester: "$semester" },
					docs: { $push: { _id: "$_id", updatedAt: "$updatedAt" } },
					count: { $sum: 1 },
				},
			},
			{ $match: { count: { $gt: 1 } } },
		]);

		type DupDoc = { _id: Types.ObjectId; updatedAt: string };
		type DupGroup = { docs: DupDoc[] };

		let deletedEvents = 0;
		for (const group of eventDuplicates as DupGroup[]) {
			const sorted = group.docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
			const idsToDelete = sorted.slice(1).map((d) => d._id);
			if (idsToDelete.length > 0) {
				const result = await Event.deleteMany({ _id: { $in: idsToDelete } });
				deletedEvents += result.deletedCount;
			}
		}

		// Deduplicate Attendance - group by unique key and keep the newest
		const attendanceDuplicates = await Attendance.aggregate([
			{ $match: { vtcStudentId } },
			{
				$group: {
					_id: { courseCode: "$courseCode", vtcStudentId: "$vtcStudentId", semester: "$semester" },
					docs: { $push: { _id: "$_id", updatedAt: "$updatedAt" } },
					count: { $sum: 1 },
				},
			},
			{ $match: { count: { $gt: 1 } } },
		]);

		let deletedAttendance = 0;
		for (const group of attendanceDuplicates as DupGroup[]) {
			const sorted = group.docs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
			const idsToDelete = sorted.slice(1).map((d) => d._id);
			if (idsToDelete.length > 0) {
				const result = await Attendance.deleteMany({ _id: { $in: idsToDelete } });
				deletedAttendance += result.deletedCount;
			}
		}

		await invalidateUserCaches(user.userId);
		revalidatePath("/");
		return { success: true, deletedEvents, deletedAttendance };
	} catch (error) {
		console.error("Error deduplicating data:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to deduplicate data",
		};
	}
}

/**
 * Per-day attended-hours breakdown for a single course, aggregated from the same
 * calendar Event source the grid's "Hours Attended" total uses (conducted events
 * whose attendance status is present). The summed minutes therefore match the
 * grid figure for that course.
 */
export async function getCourseHoursBreakdown(courseCode: string): Promise<{
	success: boolean;
	courseName?: string;
	totalMinutes?: number;
	days?: Array<{ date: string; minutes: number }>;
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: false, error: "Not signed in" };
		}

		const breakdown = await loadCourseHoursBreakdown(user, courseCode);
		return { success: true, ...breakdown };
	} catch (error) {
		console.error("Error building course hours breakdown:", error);
		return { success: false, error: error instanceof Error ? error.message : "Failed to load breakdown" };
	}
}

