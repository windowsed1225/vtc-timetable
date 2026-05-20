"use server";

import { auth } from "@/auth";
import { Types } from "mongoose";
import connectDB from "@/lib/db";
import { getCurrentSemester, getSemesterLabel } from "@/lib/utils";
import Attendance, { IClassRecord } from "@/models/Attendance";
import Event from "@/models/Event";
import User from "@/models/User";
import { revalidatePath } from "next/cache";
import { API } from "../../../vtc-api/src/core/api";
import { buildCompositeEventId, getAttendancePresence, getDurationInMinutes, isAttendanceStatusPresent, parseVtcLessonTime } from "./_helpers";
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
		// Step 1: Auth Check
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Please sign in first." };
		}
		const discordId = session.user.discordId;

		// Step 2: Get user's stored token
		await connectDB();
		const user = await User.findOne({ discordId }).lean();

		if (!user?.vtcToken) {
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
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Please sign in first." };
		}

		await connectDB();

		// Fetch user to get vtcStudentId
		const user = await User.findOne({ discordId: session.user.discordId }).lean();
		if (!user?.vtcStudentId) {
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
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: true, data: [] }; // Not logged in, return empty
		}

		await connectDB();

		const attendanceRecords = await Attendance.find({ discordId: session.user.discordId }).sort({ courseCode: 1 }).lean();

		const stats: AttendanceStats[] = attendanceRecords.map((record) => ({
			courseCode: record.courseCode,
			courseName: record.courseName,
			semester: record.semester || "SEM 2",
			status: record.status || "ACTIVE",
			attendRate: record.attendRate,
			totalClasses: record.totalClasses,
			conductedClasses: record.conductedClasses,
			attended: record.attended,
			late: record.late,
			absent: record.absent,
			isLow: record.attendRate < 80,
			isFinished: record.isFinished,
			isFollowUp: record.isFollowUp,
			baseCourseCode: record.baseCourseCode,
			classes: record.classes.map((cls) => ({
				id: cls.id,
				date: cls.date,
				lessonTime: cls.lessonTime,
				attendTime: cls.attendTime,
				roomName: cls.roomName,
				status: cls.status as "attended" | "late" | "absent",
			})),
		}));

		return { success: true, data: stats };
	} catch (error) {
		console.error("Error fetching stored attendance:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch attendance",
		};
	}
}

function getClassSemester(dateStr: string): string {
	const parts = dateStr.split("/");
	const month = parseInt(parts[1], 10);
	if (month >= 9 && month <= 12) return "SEM 1";
	if (month >= 1 && month <= 4) return "SEM 2";
	return "SEM 3";
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
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: true, data: [] }; // Not logged in, return empty
		}

		await connectDB();
		const discordId = session.user.discordId;
		const now = new Date();

		// Step 0: Fetch user to get vtcStudentId
		const user = await User.findOne({ discordId }).lean();
		if (!user?.vtcStudentId) {
			return { success: true, data: [] }; // No vtcStudentId yet, return empty
		}
		const vtcStudentId = user.vtcStudentId;

		// Step 1: Fetch attendance records from Attendance DB using vtcStudentId
		const attendanceRecords = await Attendance.find({ vtcStudentId }).sort({ courseCode: 1 }).lean();

		// Step 2: Bulk-fetch all events for this user in one query, then group by courseCode in memory
		const allCourseCodes = new Set<string>();
		for (const record of attendanceRecords) {
			allCourseCodes.add(record.courseCode);
			if (record.baseCourseCode) allCourseCodes.add(record.baseCourseCode);
		}

		const allCalendarEvents = await Event.find({
			vtcStudentId,
			courseCode: { $in: Array.from(allCourseCodes) },
			status: { $ne: "CANCELED" },
		}).lean();

		const eventsByCourseCode = new Map<string, typeof allCalendarEvents>();
		for (const event of allCalendarEvents) {
			const code = event.courseCode as string;
			if (!eventsByCourseCode.has(code)) eventsByCourseCode.set(code, []);
			eventsByCourseCode.get(code)!.push(event);
		}

		const hybridStats: HybridAttendanceStats[] = await Promise.all(
			attendanceRecords.map(async (record) => {
				const courseCode = record.courseCode;
				const baseCourseCode = record.baseCourseCode || courseCode;

				const calendarEvents = [
					...(eventsByCourseCode.get(courseCode) ?? []),
					...(courseCode !== baseCourseCode ? (eventsByCourseCode.get(baseCourseCode) ?? []) : []),
				];

				// Calculate calendar-based counts - use simple counts for display
				// But keep minute tracking for accurate percentage calculations
				let calendarTotalClasses = 0;
				let calendarConductedClasses = 0;
				let calendarRemainingClasses = 0;
				let calendarTotalHours = 0;
				let calendarConductedHours = 0;
				let calendarRemainingHours = 0;

				// Minute-based tracking (for hybrid accuracy)
				let totalSemesterMinutes = 0;
				let totalConductedMinutes = 0;
				let totalRemainingMinutes = 0;
				let totalAttendedMinutes = 0;

				let conductedEventsWithAttendanceState = 0;
				for (const event of calendarEvents) {
					const startTime = new Date(event.startTime);
					const endTime = new Date(event.endTime);
					const durationMinutes = typeof event.actualDuration === "number" && event.actualDuration > 0
						? event.actualDuration
						: getDurationInMinutes(startTime, endTime);
					const durationHours = durationMinutes / 60;

					calendarTotalClasses++;
					calendarTotalHours += durationHours;
					totalSemesterMinutes += durationMinutes;

					if (endTime < now) {
						calendarConductedClasses++;
						calendarConductedHours += durationHours;
						totalConductedMinutes += durationMinutes;

						if (typeof event.attendanceStatusCode === "number" || event.status === "ABSENT") {
							conductedEventsWithAttendanceState++;
							if (isAttendanceStatusPresent(event.attendanceStatusCode)) {
								totalAttendedMinutes += durationMinutes;
							}
						}
					} else {
						calendarRemainingClasses++;
						calendarRemainingHours += durationHours;
						totalRemainingMinutes += durationMinutes;
					}
				}

				const attended = record.attended || 0;
				const attendanceRatio = calendarConductedClasses > 0 ? attended / calendarConductedClasses : 0;
				if (conductedEventsWithAttendanceState === 0) {
					totalAttendedMinutes = totalConductedMinutes * attendanceRatio;
				}

				// Step 3: Calculate derived stats
				// Current rate based on conducted classes from calendar
				const currentAttendanceRate = calendarConductedClasses > 0 ? (attended / calendarConductedClasses) * 100 : 0;

				// Max possible rate if attend all remaining classes
				const maxPossibleRate = calendarTotalClasses > 0 ? ((attended + calendarRemainingClasses) / calendarTotalClasses) * 100 : 0;

				// Minute-based attendance rates
				const minutesAttendanceRate = totalConductedMinutes > 0 ? (totalAttendedMinutes / totalConductedMinutes) * 100 : 0;

				const maxPossibleMinutesRate = totalSemesterMinutes > 0 ? ((totalAttendedMinutes + totalRemainingMinutes) / totalSemesterMinutes) * 100 : 0;

				// Calculate safe to skip count (classes)
				let safeToSkipCount = 0;
				if (calendarTotalClasses > 0) {
					const requiredAttendance = Math.ceil(calendarTotalClasses * 0.8);
					const potentialTotal = attended + calendarRemainingClasses;
					safeToSkipCount = Math.max(0, potentialTotal - requiredAttendance);
				}

				// Calculate safe to skip minutes
				let safeToSkipMinutes = 0;
				if (totalSemesterMinutes > 0) {
					const requiredMinutes = totalSemesterMinutes * 0.8;
					const potentialMinutes = totalAttendedMinutes + totalRemainingMinutes;
					safeToSkipMinutes = Math.max(0, Math.floor(potentialMinutes - requiredMinutes));
				}

				// Determine recovery status with grace period
				// Course progress = conducted / total (0 to 1)
				const courseProgress = totalSemesterMinutes > 0 ? totalConductedMinutes / totalSemesterMinutes : 0;
				const GRACE_PERIOD_THRESHOLD = 0.15; // 15% of semester must pass before showing warnings

				let recoveryStatus: "safe" | "recoverable" | "failed" | "grace" = "safe";
				if (minutesAttendanceRate >= 80) {
					// Already meeting requirement — safe regardless of remaining classes
					recoveryStatus = "safe";
				} else if (maxPossibleMinutesRate < 80) {
					// Mathematically impossible to reach 80% even attending everything remaining
					recoveryStatus = "failed";
				} else {
					// Current rate < 80% but still recoverable
					if (courseProgress < GRACE_PERIOD_THRESHOLD) {
						// Early semester - don't show alarming badge
						recoveryStatus = "grace";
					} else {
						recoveryStatus = "recoverable";
					}
				}

				// Step 4: Handle class records
				const classes: ClassRecord[] = record.classes.map((cls) => ({
					id: cls.id,
					date: cls.date,
					lessonTime: cls.lessonTime,
					attendTime: cls.attendTime,
					roomName: cls.roomName,
					status: cls.status as "attended" | "late" | "absent",
				}));

				// Compute displaySemester: prefer semester from calendar events (matches MY CALENDARS grouping),
				// fall back to latest class date, then stored semester
				let displaySemester: string | undefined;
				if (calendarEvents.length > 0) {
					// Use semester of the latest calendar event (most current semester this course belongs to)
					const latestEvent = calendarEvents.reduce((latest, ev) => {
						return new Date(ev.startTime) > new Date(latest.startTime) ? ev : latest;
					});
					displaySemester = latestEvent.semester || undefined;
				}
				if (!displaySemester && classes.length > 0) {
					const latestClass = classes.reduce((latest, cls) => {
						const [dL, mL, yL] = latest.date.split("/").map(Number);
						const [dC, mC, yC] = cls.date.split("/").map(Number);
						return new Date(yC, mC - 1, dC) > new Date(yL, mL - 1, dL) ? cls : latest;
					});
					displaySemester = getClassSemester(latestClass.date);
				}

				// Per-semester breakdown from class records + calendar event counts
				const semesterBreakdowns: HybridAttendanceStats["semesterBreakdowns"] = {};
				for (const cls of classes) {
					const sem = getClassSemester(cls.date);
					if (!semesterBreakdowns[sem]) semesterBreakdowns[sem] = { attended: 0, conductedClasses: 0, attendanceRate: 0, calendarTotalClasses: 0 };
					semesterBreakdowns[sem].conductedClasses++;
					if (cls.status === "attended" || cls.status === "late") semesterBreakdowns[sem].attended++;
				}
				// Count calendar events per semester (creates entries for semesters with no class records yet)
				for (const event of calendarEvents) {
					const sem = event.semester as string | undefined;
					if (!sem) continue;
					if (!semesterBreakdowns[sem]) semesterBreakdowns[sem] = { attended: 0, conductedClasses: 0, attendanceRate: 0, calendarTotalClasses: 0 };
					semesterBreakdowns[sem].calendarTotalClasses++;
				}
				for (const sem of Object.keys(semesterBreakdowns)) {
					const b = semesterBreakdowns[sem]!;
					b.attendanceRate = b.conductedClasses > 0 ? Math.round((b.attended / b.conductedClasses) * 1000) / 10 : 0;
				}

				let currentSemesterStats: HybridAttendanceStats["currentSemesterStats"];
				if (classes.length > 0) {
					const targetSem = displaySemester || record.semester;
					const currentSemClasses = classes.filter((cls) => getClassSemester(cls.date) === targetSem);
					const semConducted = currentSemClasses.length;
					const semAttended = currentSemClasses.filter((c) => c.status === "attended" || c.status === "late").length;
					currentSemesterStats = {
						semester: targetSem,
						attended: semAttended,
						conductedClasses: semConducted,
						attendanceRate: semConducted > 0 ? Math.round((semAttended / semConducted) * 1000) / 10 : 0,
					};
				}

				// Build hybrid stats object
				const hybridStat: HybridAttendanceStats = {
					// Original attendance fields
					courseCode: record.courseCode,
					courseName: record.courseName,
					semester: record.semester || "SEM 2",
					status: record.status || "ACTIVE",
					attendRate: record.attendRate,
					totalClasses: record.totalClasses,
					conductedClasses: record.conductedClasses,
					attended,
					late: record.late || 0,
					absent: record.absent || 0,
					isLow: minutesAttendanceRate < 80,
					isFinished: record.isFinished,
					isFollowUp: record.isFollowUp,
					baseCourseCode: record.baseCourseCode || courseCode,
					classes,

					// Calendar-based fields
					calendarTotalClasses,
					calendarConductedClasses,
					calendarRemainingClasses,
					calendarTotalHours: Math.round(calendarTotalHours * 10) / 10,
					calendarConductedHours: Math.round(calendarConductedHours * 10) / 10,
					calendarRemainingHours: Math.round(calendarRemainingHours * 10) / 10,

					// Minute-based fields
					totalAttendedMinutes: Math.round(totalAttendedMinutes),
					totalConductedMinutes: Math.round(totalConductedMinutes),
					totalSemesterMinutes: Math.round(totalSemesterMinutes),
					totalRemainingMinutes: Math.round(totalRemainingMinutes),

					// Derived calculations
					currentAttendanceRate: Math.round(currentAttendanceRate * 10) / 10,
					maxPossibleRate: Math.round(maxPossibleRate * 10) / 10,
					minutesAttendanceRate: Math.round(minutesAttendanceRate * 10) / 10,
					maxPossibleMinutesRate: Math.round(maxPossibleMinutesRate * 10) / 10,
					safeToSkipCount,
					safeToSkipMinutes,
					recoveryStatus,
					displaySemester,
					currentSemesterStats,
					semesterBreakdowns,
				};

				return hybridStat;
			}),
		);

		return { success: true, data: hybridStats };
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
					isLow: finalRate < 80,
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
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Please sign in first." };
		}

		await connectDB();
		const discordId = session.user.discordId;

		// Fetch user to get vtcStudentId
		const user = await User.findOne({ discordId }).lean();
		if (!user?.vtcStudentId) {
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

