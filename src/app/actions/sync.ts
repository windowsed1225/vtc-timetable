"use server";

import { auth } from "@/auth";
import { getColorIndex } from "@/lib/colors";
import connectDB from "@/lib/db";
import { getCurrentSemester, getSemestersToSync } from "@/lib/utils";
import Attendance, { IClassRecord } from "@/models/Attendance";
import Event from "@/models/Event";
import User from "@/models/User";
import { TimetableEvent } from "@/types/timetable";
import { revalidatePath } from "next/cache";
import { API } from "../../../vtc-api/src/core/api";
import { buildCompositeEventId, extractToken, getAttendancePresence, getDurationInMinutes, parseVtcLessonTime, SEMESTER_CATEGORY_MAP, SEMESTER_END_DATES, SEMESTER_MAP } from "./_helpers";
import type { VtcApiResponse } from "./types";

type UpsertAttendanceEventInput = {
	cls: {
		date: string;
		lessonTime: string;
		roomName?: string;
		status?: number | null;
		attendTime?: string | null;
	};
	vtcStudentId: string;
	semester: "SEM 1" | "SEM 2" | "SEM 3";
	courseCode: string;
	courseTitle: string;
	colorIndex: number;
	fallbackLocation?: string;
};

function resolveEventStatusFromAttendance(attendanceStatus: "attended" | "late" | "absent", endTime: Date, now: Date) {
	if (attendanceStatus === "absent") {
		return "ABSENT" as const;
	}

	return endTime < now ? ("FINISHED" as const) : ("UPCOMING" as const);
}

async function upsertAttendanceAdjustedEvent({ cls, vtcStudentId, semester, courseCode, courseTitle, colorIndex, fallbackLocation = "" }: UpsertAttendanceEventInput) {
	const parsedTime = parseVtcLessonTime(cls.date, cls.lessonTime);
	if (!parsedTime) {
		return null;
	}

	const actualStart = new Date(parsedTime.start * 1000);
	const actualEnd = new Date(parsedTime.end * 1000);
	const attendanceStatus = getAttendancePresence(cls);
	const nextVtcId = buildCompositeEventId(courseCode, parsedTime.start, parsedTime.end);
	const dayStart = new Date(`${parsedTime.isoDate}T00:00:00+08:00`);
	const dayEnd = new Date(`${parsedTime.isoDate}T23:59:59+08:00`);

	const sameDayEvents = await Event.find({
		vtcStudentId,
		semester,
		courseCode,
		startTime: { $gte: dayStart, $lte: dayEnd },
	}).sort({ startTime: 1 });

	const matchingEvent =
		sameDayEvents.find((eventDoc) => eventDoc.vtc_id === nextVtcId) ??
		sameDayEvents.reduce<(typeof sameDayEvents)[number] | null>((closest, candidate) => {
			if (!closest) {
				return candidate;
			}

			const candidateDelta = Math.abs(new Date(candidate.startTime).getTime() - actualStart.getTime()) + Math.abs(new Date(candidate.endTime).getTime() - actualEnd.getTime());
			const closestDelta = Math.abs(new Date(closest.startTime).getTime() - actualStart.getTime()) + Math.abs(new Date(closest.endTime).getTime() - actualEnd.getTime());
			return candidateDelta < closestDelta ? candidate : closest;
		}, null);

	const scheduledStart = matchingEvent?.scheduledStartTime ?? matchingEvent?.startTime ?? actualStart;
	const scheduledEnd = matchingEvent?.scheduledEndTime ?? matchingEvent?.endTime ?? actualEnd;
	const scheduledDuration = matchingEvent?.scheduledDuration ?? getDurationInMinutes(new Date(scheduledStart), new Date(scheduledEnd));
	const isTimeAdjusted = Math.abs(new Date(scheduledStart).getTime() - actualStart.getTime()) > 60000 || Math.abs(new Date(scheduledEnd).getTime() - actualEnd.getTime()) > 60000;

	const update = {
		vtc_id: nextVtcId,
		vtcStudentId,
		semester,
		status: resolveEventStatusFromAttendance(attendanceStatus, actualEnd, new Date()),
		courseCode,
		courseTitle,
		startTime: actualStart,
		endTime: actualEnd,
		scheduledStartTime: scheduledStart,
		scheduledEndTime: scheduledEnd,
		scheduledDuration,
		actualDuration: parsedTime.duration,
		isTimeAdjusted,
		attendanceStatusCode: cls.status ?? null,
		location: cls.roomName?.trim() || matchingEvent?.location || fallbackLocation,
		colorIndex,
	};

	if (matchingEvent) {
		return Event.findOneAndUpdate({ _id: matchingEvent._id }, { $set: update }, { returnDocument: "after" });
	}

	return Event.findOneAndUpdate(
		{ vtc_id: nextVtcId, vtcStudentId, semester },
		{
			$set: update,
			$setOnInsert: {
				lessonType: "",
				lecturerName: "",
			},
		},
		{ upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
	);
}
/**
 * Main sync function that handles authentication and data persistence
 * This is the primary entry point for syncing VTC data
 */
export async function syncVtcData(
	vtcUrl: string,
	semesterNum: number = getCurrentSemester(),
): Promise<{
	success: boolean;
	error?: string;
	vtcStudentId?: string;
	newEvents?: number;
	newAttendance?: number;
}> {
	try {
		// Step 1: Auth Check
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Please sign in with Discord first." };
		}
		const discordId = session.user.discordId;

		// Step 2: Token Check
		let token: string | null = null;
		if (vtcUrl.startsWith("http")) {
			token = extractToken(vtcUrl);
		} else {
			token = vtcUrl; // Direct token pass
		}

		if (!token) {
			return { success: false, error: "Invalid VTC URL or token." };
		}

		const api = new API({ token });

		// Step 3: ID Extraction - Call VTC API to verify token & get student ID
		const userResponse = await api.checkAccessToken();
		if (!userResponse.isSuccess) {
			return { success: false, error: "Invalid VTC token. Please get a new URL from VTC app." };
		}

		const vtcStudentId = userResponse.payload.vtcID;

		// Step 4: Save token and vtcStudentId to User
		await connectDB();
		await User.findOneAndUpdate({ discordId }, { vtcToken: token, vtcStudentId, lastSync: new Date() }, { upsert: true });

		// Step 5: Determine semester category
		const primarySemester = SEMESTER_CATEGORY_MAP[semesterNum];
		if (!primarySemester) {
			return {
				success: false,
				error: "Invalid semester number. Use 1 (Fall), 2 (Spring), or 3 (Summer).",
			};
		}

		const currentYear = new Date().getFullYear();
		const now = new Date();
		let newEventsCount = 0;

		// Helper function to fetch and save timetable for a specific semester/year
		// Uses "check then insert" logic - only inserts new events, never updates existing ones
		const fetchSemesterTimetable = async (semNum: number, semCategory: "SEM 1" | "SEM 2" | "SEM 3", yearOverride?: number): Promise<number> => {
			const months = SEMESTER_MAP[semNum];
			if (!months) return 0;

			let count = 0;

			for (const month of months) {
				// Determine year: use override if provided, otherwise calculate based on semester
				const year = yearOverride ?? currentYear;
				// For Fall semester (Sept-Dec), use the provided year
				// For Spring/Summer, use current year unless overridden

				const response = await api.getTimeTableAndReminderList(month, year);

				if (response.isSuccess && response.payload?.timetable?.add) {
					const events = response.payload.timetable.add;

					// Step 1: Generate composite IDs and collect valid events
					const validEvents = events
						.filter((event: TimetableEvent) => {
							// Check for required fields
							if (!event.courseCode || !event.weekNum || !event.startTime || !event.endTime) {
								console.warn("Skipping event with missing required fields", event);
								return false;
							}
							return true;
						})
						.map((event: TimetableEvent) => ({
							...event,
							compositeId: `${event.courseCode}-${event.startTime}-${event.endTime}`,
						}));

					type ValidEvent = (typeof validEvents)[number];

					if (validEvents.length === 0) continue;

					// Step 2: Extract composite IDs from this batch
					const batchVtcIds = validEvents.map((event: ValidEvent) => event.compositeId);

					// Step 3: Query MongoDB for existing events with these vtc_ids (scoped to vtcStudentId)
					const existingEvents = await Event.find({
						vtc_id: { $in: batchVtcIds },
						vtcStudentId: vtcStudentId,
					})
						.select("vtc_id")
						.lean();

					// Step 4: Create a Set of existing vtc_ids for efficient lookup
					const existingVtcIds = new Set(existingEvents.map((e) => e.vtc_id));

					// Step 5: Filter to only new events that don't exist in DB
					const newEvents = validEvents.filter((event: ValidEvent) => !existingVtcIds.has(event.compositeId));

					if (newEvents.length === 0) continue;

					// Step 6: Prepare documents for insertMany
					const documentsToInsert = newEvents.map((event: ValidEvent) => {
						const eventStartTime = new Date(event.startTime * 1000);
						const eventEndTime = new Date(event.endTime * 1000);
						const scheduledDuration = getDurationInMinutes(eventStartTime, eventEndTime);
						const calculatedStatus: "FINISHED" | "UPCOMING" = eventEndTime < now ? "FINISHED" : "UPCOMING";

						return {
							vtc_id: event.compositeId,
							vtcStudentId: vtcStudentId,
							semester: semCategory,
							status: calculatedStatus,
							courseCode: event.courseCode,
							courseTitle: event.courseTitle,
							lessonType: event.lessonType || "",
							startTime: eventStartTime,
							endTime: eventEndTime,
							scheduledStartTime: eventStartTime,
							scheduledEndTime: eventEndTime,
							scheduledDuration,
							actualDuration: scheduledDuration,
							isTimeAdjusted: false,
							attendanceStatusCode: null,
							location: `${event.campusCode || ""}-${event.roomNum || ""}`.replace(/^-|-$/g, ""),
							lecturerName: event.lecturerName || "",
							colorIndex: getColorIndex(event.courseCode),
						};
					});

					// Step 7: Insert only new events using insertMany
					// Use ordered: false to continue inserting even if some fail (e.g., race condition duplicates)
					try {
						const result = await Event.insertMany(documentsToInsert, { ordered: false });
						count += result.length;
					} catch (insertError: unknown) {
						// Handle duplicate key errors gracefully (in case of race conditions)
						const err = insertError as { code?: number; insertedDocs?: unknown[] };
						if (err.code === 11000 && err.insertedDocs) {
							// Some documents were inserted before the duplicate error
							count += err.insertedDocs.length;
						} else if (err.code !== 11000) {
							// Re-throw non-duplicate errors
							throw insertError;
						}
						// For pure duplicate errors with no insertedDocs, count stays the same
					}
				}
			}

			return count;
		};

		// Step 6: Fetch timetables with backfill logic
		// Semester 1 (Fall): Just fetch Fall
		// Semester 2 (Spring): Fetch Spring (current year) + Fall (previous year)
		// Semester 3 (Summer): Fetch Summer (current year) + Spring (current year)

		const fetchPromises: Promise<number>[] = [];

		switch (semesterNum) {
			case 1: {
				// If current month is Jan–Aug (0–7), Fall was in the previous calendar year
				const sem1Year = new Date().getMonth() >= 8 ? currentYear : currentYear - 1;
				fetchPromises.push(fetchSemesterTimetable(1, "SEM 1", sem1Year));
				break;
			}

			case 2: // Spring - also fetch Fall from previous year
				fetchPromises.push(
					fetchSemesterTimetable(2, "SEM 2", currentYear), // Primary: Spring current year
					fetchSemesterTimetable(1, "SEM 1", currentYear - 1), // Backfill: Fall previous year
				);
				break;

			case 3: // Summer - also fetch Spring from current year
				fetchPromises.push(
					fetchSemesterTimetable(3, "SEM 3", currentYear), // Primary: Summer current year
					fetchSemesterTimetable(2, "SEM 2", currentYear), // Backfill: Spring current year
				);
				break;
		}

		// Execute all fetches in parallel
		const results = await Promise.all(fetchPromises);
		newEventsCount = results.reduce((sum, count) => sum + count, 0);

		// Step 6: Fetch and save Attendance
		const listResponse = await api.getClassAttendanceList();
		let newAttendanceCount = 0;

		if (listResponse.isSuccess && listResponse.payload?.courses) {
			const courses = listResponse.payload.courses;

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
							const classId = parsedTime ? buildCompositeEventId(course.courseCode, parsedTime.start, parsedTime.end) : cls.id;
							const status = getAttendancePresence(cls);

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

					// Derive semester from earliest class date (mirrors attendance.ts logic).
					// Prevents cross-semester bleed when the API returns courses from multiple semesters.
					let courseSemester: "SEM 1" | "SEM 2" | "SEM 3" = primarySemester;
					if (classRecords.length > 0) {
						const dateParts = classRecords[0].date.split("/");
						if (dateParts.length === 3) {
							const month = parseInt(dateParts[1], 10);
							if (month >= 9 && month <= 12) courseSemester = "SEM 1";
							else if (month >= 1 && month <= 4) courseSemester = "SEM 2";
							else courseSemester = "SEM 3";
						}
					}

					// Upsert adjusted calendar events now that semester is known
					if (detailResponse.isSuccess && detailResponse.payload?.classes) {
						for (const cls of detailResponse.payload.classes) {
							await upsertAttendanceAdjustedEvent({
								cls,
								vtcStudentId,
								semester: courseSemester,
								courseCode: course.courseCode,
								courseTitle: course.name?.en || course.courseCode,
								colorIndex: getColorIndex(course.courseCode),
								fallbackLocation: cls.roomName,
							});
						}
					}

					const totalScheduled = detailResponse.payload?.totalNumOfClass || 0;
					const attendRate = totalConducted > 0 ? (attended / totalConducted) * 100 : 0;
					const isFollowUp = /A$/.test(course.courseCode);
					const baseCourseCode = isFollowUp ? course.courseCode.slice(0, -1) : course.courseCode;
					const semesterEnd = SEMESTER_END_DATES[courseSemester];
					const semesterEndDate = new Date(currentYear, semesterEnd.month - 1, semesterEnd.day, 23, 59, 59);
					const isPastSemesterEnd = now > semesterEndDate;
					const meetsClassThreshold = totalConducted > 10;
					const attendanceStatus: "ACTIVE" | "FINISHED" = isPastSemesterEnd && meetsClassThreshold ? "FINISHED" : "ACTIVE";

					return {
						updateOne: {
							filter: { courseCode: course.courseCode, vtcStudentId, semester: courseSemester },
							update: {
								$set: {
									vtcStudentId,
									semester: courseSemester,
									status: attendanceStatus,
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
				newAttendanceCount = result.upsertedCount;
			}

			// Remove stale Attendance records where the semester was mis-tagged in a previous sync.
			// Build a map of courseCode -> correct semester from the ops we just wrote.
			const correctSemesterMap: Record<string, string> = {};
			for (const op of attendanceOps) {
				if ("updateOne" in op) {
					const { courseCode, semester } = op.updateOne.filter as { courseCode: string; semester: string };
					correctSemesterMap[courseCode] = semester;
				}
			}
			const staleDeleteOps = Object.entries(correctSemesterMap).map(([courseCode, correctSemester]) => ({
				deleteMany: {
					filter: { vtcStudentId, courseCode, semester: { $ne: correctSemester } },
				},
			}));
			if (staleDeleteOps.length > 0) {
				await Attendance.bulkWrite(staleDeleteOps);
			}
		}

		revalidatePath("/");
		return {
			success: true,
			vtcStudentId,
			newEvents: newEventsCount,
			newAttendance: newAttendanceCount,
		};
	} catch (error) {
		console.error("Error syncing VTC data:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to sync VTC data",
		};
	}
}

/**
 * Auto-sync from stored token
 * Uses the stored VTC token from User database to sync data
 * Automatically detects semester based on current date
 */
export async function autoSyncFromStoredToken(options?: { fetchAll?: boolean }): Promise<{
	success: boolean;
	error?: string;
	vtcStudentId?: string;
	newEvents?: number;
	newAttendance?: number;
}> {
	try {
		// Step 1: Auth Check
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Please sign in first." };
		}

		await connectDB();
		const discordId = session.user.discordId;

		// Step 2: Get stored token from User
		const user = await User.findOne({ discordId }).lean();
		if (!user?.vtcToken) {
			return { success: false, error: "No stored VTC token found. Please sync manually first." };
		}

		// Step 3: Detect semesters to sync
		// fetchAll = true: Full sync — fetch all 3 semesters (new users / forced refresh)
		// fetchAll = false/undefined: Smart sync — only current/upcoming semesters
		const semesters = options?.fetchAll ? [1, 2, 3] : getSemestersToSync();

		// Step 4: Sync each semester and aggregate results
		let newEvents = 0;
		let newAttendance = 0;
		let vtcStudentId: string | undefined;

		for (const semesterNum of semesters) {
			const result = await syncVtcData(user.vtcToken, semesterNum);
			if (!result.success) return result;
			newEvents += result.newEvents ?? 0;
			newAttendance += result.newAttendance ?? 0;
			vtcStudentId = result.vtcStudentId;
		}

		return { success: true, vtcStudentId, newEvents, newAttendance };
	} catch (error) {
		console.error("Error auto-syncing VTC data:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to auto-sync VTC data",
		};
	}
}

/**
 * Sync a single semester from stored token — used by the client for per-semester progress reporting
 */
export async function syncSemesterFromStoredToken(semesterNum: number): Promise<{
	success: boolean;
	error?: string;
	newEvents?: number;
	newAttendance?: number;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Please sign in first." };
		}
		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();
		if (!user?.vtcToken) {
			return { success: false, error: "No stored VTC token found. Please sync manually first." };
		}
		const result = await syncVtcData(user.vtcToken, semesterNum);
		return result;
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Failed to sync" };
	}
}

/**
 * Check if auto-sync should run based on last sync time
 * Returns true if last sync was more than 15 minutes ago or never synced
 */
export async function shouldAutoSync(): Promise<{
	should: boolean;
	lastSync?: Date;
	minutesSinceLastSync?: number;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) {
			return { should: false };
		}

		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();

		if (!user?.vtcToken) {
			return { should: false }; // No token, can't auto-sync
		}

		if (!user.lastSync) {
			return { should: true }; // Never synced before
		}

		const now = new Date();
		const lastSync = new Date(user.lastSync);
		const minutesSinceLastSync = (now.getTime() - lastSync.getTime()) / 1000 / 60;

		// Throttle: only sync if last sync was more than 15 minutes ago
		const THROTTLE_MINUTES = 15;
		const should = minutesSinceLastSync > THROTTLE_MINUTES;

		return {
			should,
			lastSync,
			minutesSinceLastSync: Math.floor(minutesSinceLastSync),
		};
	} catch (error) {
		console.error("Error checking auto-sync:", error);
		return { should: false };
	}
}

/**
 * Legacy timetable sync entry point.
 * Delegate to syncVtcData so Event writes always include the required schema fields.
 */
export async function syncTimetable(
	vtcUrl: string,
	semesterNum: number = getCurrentSemester(),
): Promise<{
	success: boolean;
	newCount?: number;
	updatedCount?: number;
	error?: string;
}> {
	const result = await syncVtcData(vtcUrl, semesterNum);

	return {
		success: result.success,
		newCount: result.newEvents,
		updatedCount: 0,
		error: result.error,
	};
}

/**
 * Check if a background sync is needed (more than 24h since last sync)
 */
export async function checkAndSyncBackground(): Promise<{
	success: boolean;
	error?: string;
	message?: string;
	newEvents?: number;
	newAttendance?: number;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) return { success: false, error: "Not logged in" };

		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();

		if (!user?.vtcToken) return { success: false, error: "No token stored" };

		const lastSync = user.lastSync ? new Date(user.lastSync) : new Date(0);
		const now = new Date();
		const diffHours = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

		if (diffHours >= 24) {
			console.log("Background sync triggered for user:", session.user.discordId);
			const semesters = getSemestersToSync();
			let newEvents = 0;
			let newAttendance = 0;

			for (const semesterNum of semesters) {
				const result = await syncVtcData(user.vtcToken, semesterNum);
				if (!result.success) return result;
				newEvents += result.newEvents ?? 0;
				newAttendance += result.newAttendance ?? 0;
			}

			return { success: true, newEvents, newAttendance };
		}

		return { success: true, message: "Sync not needed yet" };
	} catch (error) {
		return { success: false, error: error instanceof Error ? error.message : "Background sync failed" };
	}
}

// Keep the legacy function for backward compatibility
export async function fetchTimetable(token: string, semesterNum: number = getCurrentSemester()): Promise<{ success: boolean; data?: TimetableEvent[]; error?: string }> {
	try {
		const months = SEMESTER_MAP[semesterNum];
		if (!months) {
			return {
				success: false,
				error: "Invalid semester number. Use 1 (Fall), 2 (Spring), or 3 (Summer).",
			};
		}

		const api = new API({ token });
		const currentYear = new Date().getFullYear();
		const lectureList: TimetableEvent[] = [];

		for (const month of months) {
			let effectiveYear = currentYear;

			if (semesterNum === 1 && [9, 10, 11, 12].includes(month)) {
				effectiveYear = currentYear - 1;
			}

			console.log(`Fetching Semester ${semesterNum}: Month ${month}, Year ${effectiveYear}`);

			try {
				const response = (await api.getTimeTableAndReminderList(month, effectiveYear)) as VtcApiResponse;

				if (!response.isSuccess) {
					console.warn(`API error for month ${month}:`, response.errorMsg);
					continue;
				}

				const rawList = response.payload?.timetable?.add || [];
				lectureList.push(...rawList);
			} catch (err) {
				console.error(`Error processing month ${month}:`, err instanceof Error ? err.message : err);
			}
		}

		if (lectureList.length === 0) {
			return {
				success: false,
				error: "No timetable events found for the selected semester.",
			};
		}

		return { success: true, data: lectureList };
	} catch (error) {
		console.error("Error fetching timetable:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch timetable",
		};
	}
}
