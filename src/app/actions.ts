"use server";

import { revalidatePath } from "next/cache";
import { TimetableEvent, CalendarEvent } from "@/types/timetable";
import { API } from "../../vtc-api/src/core/api";
import connectDB from "@/lib/db";
import Event from "@/models/Event";
import User from "@/models/User";
import Attendance from "@/models/Attendance";
import { getColorIndex } from "@/lib/colors";
import { auth } from "@/auth";

// Semester to months mapping
const SEMESTER_MAP: Record<number, number[]> = {
    1: [9, 10, 11, 12], // Sept-Dec
    2: [1, 2, 3, 4], // Jan-Apr
    3: [5, 6, 7, 8], // May-Aug (Summer)
};


// Define the expected response structure from vtc-api
interface TimetableData {
    add: TimetableEvent[];
    delete: unknown[];
    update: unknown[];
}

interface VtcApiResponse {
    isSuccess: boolean;
    errorCode: number;
    errorMsg: string | null;
    payload: {
        timetable: TimetableData;
        exam: TimetableData;
        currentTimestamp: number;
        lastUpdatedTimestamp: number;
        isDropDB: boolean;
        holiday: TimetableData;
        personal: TimetableData;
    };
}

// Extract token from VTC URL
function extractToken(vtcUrl: string): string | null {
    try {
        const url = new URL(vtcUrl);
        return url.searchParams.get("token");
    } catch {
        return null;
    }
}

/**
 * Main sync function that handles authentication and data persistence
 * This is the primary entry point for syncing VTC data
 */
export async function syncVtcData(vtcUrl: string, semesterNum: number = 2): Promise<{
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
        await User.findOneAndUpdate(
            { discordId },
            { vtcToken: token, vtcStudentId, lastSync: new Date() },
            { upsert: true }
        );

        // Step 5: Determine semester category
        const SEMESTER_CATEGORY_MAP: Record<number, "SEM 1" | "SEM 2" | "SEM 3"> = {
            1: "SEM 1",  // Fall
            2: "SEM 2",  // Spring
            3: "SEM 3",  // Summer
        };
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
        const fetchSemesterTimetable = async (
            semNum: number,
            semCategory: "SEM 1" | "SEM 2" | "SEM 3",
            yearOverride?: number
        ): Promise<number> => {
            const months = SEMESTER_MAP[semNum];
            if (!months) return 0;

            let count = 0;

            for (const month of months) {
                // Determine year: use override if provided, otherwise calculate based on semester
                let year = yearOverride ?? currentYear;
                // For Fall semester (Sept-Dec), use the provided year
                // For Spring/Summer, use current year unless overridden

                const response = await api.getTimeTableAndReminderList(month, year);

                if (response.isSuccess && response.payload?.timetable?.add) {
                    const events = response.payload.timetable.add;

                    const bulkOps = events.map((event: TimetableEvent) => {
                        const eventEndTime = new Date(event.endTime * 1000);
                        const calculatedStatus: "FINISHED" | "UPCOMING" = eventEndTime < now ? "FINISHED" : "UPCOMING";

                        return {
                            updateOne: {
                                filter: { vtc_id: event.id, discordId, semester: semCategory },
                                update: [
                                    {
                                        $set: {
                                            discordId: discordId,
                                            vtcStudentId: vtcStudentId,
                                            semester: semCategory,
                                            status: {
                                                $cond: {
                                                    if: { $in: ["$status", ["CANCELED", "RESCHEDULED"]] },
                                                    then: "$status",
                                                    else: calculatedStatus
                                                }
                                            },
                                            vtc_id: event.id,
                                            courseCode: event.courseCode,
                                            courseTitle: event.courseTitle,
                                            lessonType: event.lessonType || "",
                                            startTime: new Date(event.startTime * 1000),
                                            endTime: eventEndTime,
                                            location: `${event.campusCode || ""}-${event.roomNum || ""}`.replace(/^-|-$/g, ""),
                                            lecturerName: event.lecturerName || "",
                                            colorIndex: getColorIndex(event.courseCode),
                                        },
                                    }
                                ],
                                upsert: true,
                            },
                        };
                    });

                    if (bulkOps.length > 0) {
                        const result = await Event.bulkWrite(bulkOps);
                        count += result.upsertedCount;
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
            case 1: // Fall - no backfill
                fetchPromises.push(fetchSemesterTimetable(1, "SEM 1", currentYear));
                break;

            case 2: // Spring - also fetch Fall from previous year
                fetchPromises.push(
                    fetchSemesterTimetable(2, "SEM 2", currentYear),  // Primary: Spring current year
                    fetchSemesterTimetable(1, "SEM 1", currentYear - 1)  // Backfill: Fall previous year
                );
                break;

            case 3: // Summer - also fetch Spring from current year
                fetchPromises.push(
                    fetchSemesterTimetable(3, "SEM 3", currentYear),  // Primary: Summer current year
                    fetchSemesterTimetable(2, "SEM 2", currentYear)   // Backfill: Spring current year
                );
                break;
        }

        // Execute all fetches in parallel
        const results = await Promise.all(fetchPromises);
        newEventsCount = results.reduce((sum, count) => sum + count, 0);

        // Use the primary semester as fallback for attendance tagging
        const fallbackSemester = primarySemester;

        // Step 6: Fetch and save Attendance with both IDs
        // Semester order for comparison
        const SEMESTER_ORDER_MAP: Record<string, number> = {
            "SEM 1": 1,
            "SEM 2": 2,
            "SEM 3": 3,
        };

        // First, build a map of courseCode -> semester from Calendar events
        const courseToSemesterMap: Record<string, string> = {};
        const existingEvents = await Event.find({ discordId }).select('courseCode semester').lean();
        for (const event of existingEvents) {
            // Use the most recent semester for each course (in case of duplicates)
            if (!courseToSemesterMap[event.courseCode] ||
                (SEMESTER_ORDER_MAP[event.semester] || 0) > (SEMESTER_ORDER_MAP[courseToSemesterMap[event.courseCode]] || 0)) {
                courseToSemesterMap[event.courseCode] = event.semester;
            }
        }

        const listResponse = await api.getClassAttendanceList();
        let newAttendanceCount = 0;

        if (listResponse.isSuccess && listResponse.payload?.courses) {
            const courses = listResponse.payload.courses;

            const attendanceOps = await Promise.all(
                courses.map(async (course) => {
                    // Get semester from Calendar events, fallback to primary semester
                    const courseSemester = (courseToSemesterMap[course.courseCode] || fallbackSemester) as "SEM 1" | "SEM 2" | "SEM 3";

                    const detailResponse = await api.getClassAttendanceDetail(course.courseCode);

                    let attended = 0;
                    let late = 0;
                    let absent = 0;
                    let totalConducted = 0;
                    const classRecords: Array<{
                        id: string;
                        date: string;
                        lessonTime: string;
                        attendTime: string;
                        roomName: string;
                        status: "attended" | "late" | "absent";
                    }> = [];

                    if (detailResponse.isSuccess && detailResponse.payload?.classes) {
                        for (const cls of detailResponse.payload.classes) {
                            totalConducted++;
                            let status: "attended" | "late" | "absent" = "absent";

                            if (cls.attendTime === "-" || !cls.attendTime) {
                                absent++;
                                status = "absent";
                            } else if (cls.status === 3) {
                                late++;
                                attended++;
                                status = "late";
                            } else {
                                attended++;
                                status = "attended";
                            }

                            classRecords.push({
                                id: cls.id,
                                date: cls.date,
                                lessonTime: cls.lessonTime,
                                attendTime: cls.attendTime,
                                roomName: cls.roomName,
                                status,
                            });
                        }
                    }

                    const totalScheduled = detailResponse.payload?.totalNumOfClass || 0;
                    const attendRate = totalConducted > 0 ? (attended / totalConducted) * 100 : 0;
                    const isFollowUp = /A$/.test(course.courseCode);
                    const baseCourseCode = isFollowUp ? course.courseCode.slice(0, -1) : course.courseCode;

                    // Determine attendance status (ACTIVE or FINISHED)
                    // Rule: FINISHED if semester is over AND course has > 10 classes conducted
                    const SEMESTER_END_DATES: Record<string, { month: number; day: number }> = {
                        "SEM 1": { month: 12, day: 31 },  // December 31st
                        "SEM 2": { month: 5, day: 31 },   // May 31st
                        "SEM 3": { month: 8, day: 31 },   // August 31st
                    };

                    const semesterEnd = SEMESTER_END_DATES[courseSemester];
                    const semesterEndDate = new Date(currentYear, semesterEnd.month - 1, semesterEnd.day, 23, 59, 59);
                    const isPastSemesterEnd = now > semesterEndDate;
                    const meetsClassThreshold = totalConducted > 10;

                    // Status is FINISHED only if both conditions are met
                    const attendanceStatus: "ACTIVE" | "FINISHED" =
                        (isPastSemesterEnd && meetsClassThreshold) ? "FINISHED" : "ACTIVE";

                    return {
                        updateOne: {
                            filter: { courseCode: course.courseCode, discordId, semester: courseSemester },
                            update: {
                                $set: {
                                    discordId,
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
                })
            );

            if (attendanceOps.length > 0) {
                const result = await Attendance.bulkWrite(attendanceOps);
                newAttendanceCount = result.upsertedCount;
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
                const classRecords: Array<{
                    id: string;
                    date: string;
                    lessonTime: string;
                    attendTime: string;
                    roomName: string;
                    status: "attended" | "late" | "absent";
                }> = [];

                if (detailResponse.isSuccess && detailResponse.payload?.classes) {
                    for (const cls of detailResponse.payload.classes) {
                        totalConducted++;
                        let status: "attended" | "late" | "absent" = "absent";

                        if (cls.attendTime === "-" || !cls.attendTime) {
                            absent++;
                            status = "absent";
                        } else if (cls.status === 3) {
                            late++;
                            attended++;
                            status = "late";
                        } else {
                            attended++;
                            status = "attended";
                        }

                        classRecords.push({
                            id: cls.id,
                            date: cls.date,
                            lessonTime: cls.lessonTime,
                            attendTime: cls.attendTime,
                            roomName: cls.roomName,
                            status,
                        });
                    }
                }

                const totalScheduled = detailResponse.payload?.totalNumOfClass || 0;
                const attendRate = totalConducted > 0 ? (attended / totalConducted) * 100 : 0;
                const isFollowUp = /A$/.test(course.courseCode);
                const baseCourseCode = isFollowUp ? course.courseCode.slice(0, -1) : course.courseCode;

                return {
                    updateOne: {
                        filter: { courseCode: course.courseCode, discordId },
                        update: {
                            $set: {
                                discordId,
                                vtcStudentId,
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
            })
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
 * Sync timetable from VTC API and store in MongoDB
 */
export async function syncTimetable(
    vtcUrl: string,
    semesterNum: number = 2
): Promise<{
    success: boolean;
    newCount?: number;
    updatedCount?: number;
    error?: string;
}> {
    try {
        const token = extractToken(vtcUrl);
        if (!token) {
            return { success: false, error: "Invalid URL. No token found." };
        }

        const months = SEMESTER_MAP[semesterNum];
        if (!months) {
            return {
                success: false,
                error: "Invalid semester number. Use 1 (Fall), 2 (Spring), or 3 (Summer).",
            };
        }

        await connectDB();

        const api = new API({ token });
        const currentYear = new Date().getFullYear();
        const lectureList: TimetableEvent[] = [];

        // Fetch all months for the semester
        for (const month of months) {
            let effectiveYear = currentYear;

            if (semesterNum === 1 && [9, 10, 11, 12].includes(month)) {
                effectiveYear = currentYear - 1;
            }

            console.log(`Fetching Semester ${semesterNum}: Month ${month}, Year ${effectiveYear}`);

            try {
                const response = (await api.getTimeTableAndReminderList(
                    month,
                    effectiveYear
                )) as VtcApiResponse;

                if (!response.isSuccess) {
                    console.warn(`API error for month ${month}:`, response.errorMsg);
                    continue;
                }

                const rawList = response.payload?.timetable?.add || [];
                lectureList.push(...rawList);
            } catch (err) {
                console.error(
                    `Error processing month ${month}:`,
                    err instanceof Error ? err.message : err
                );
            }
        }

        if (lectureList.length === 0) {
            return {
                success: false,
                error: "No timetable events found for the selected semester.",
            };
        }

        // Upsert all events to MongoDB
        let newCount = 0;
        let updatedCount = 0;

        for (const event of lectureList) {
            const result = await Event.findOneAndUpdate(
                { vtc_id: event.id },
                {
                    vtc_id: event.id,
                    courseCode: event.courseCode,
                    courseTitle: event.courseTitle,
                    lessonType: event.lessonType,
                    startTime: new Date(event.startTime * 1000),
                    endTime: new Date(event.endTime * 1000),
                    location: `${event.campusCode} ${event.roomNum}`.trim(),
                    lecturerName: event.lecturerName,
                    colorIndex: getColorIndex(event.courseCode),
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                newCount++;
            } else {
                updatedCount++;
            }
        }

        revalidatePath("/");

        return { success: true, newCount, updatedCount };
    } catch (error) {
        console.error("Error syncing timetable:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to sync timetable",
        };
    }
}

/**
 * Get stored events from MongoDB for the authenticated user
 */
export async function getStoredEvents(): Promise<{
    success: boolean;
    data?: CalendarEvent[];
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user?.discordId) {
            return { success: true, data: [] }; // Not logged in, return empty
        }

        await connectDB();

        const events = await Event.find({ discordId: session.user.discordId })
            .sort({ startTime: 1 })
            .lean();

        const calendarEvents: CalendarEvent[] = events.map((event: any) => ({
            title: `${event.courseTitle}`,
            start: new Date(event.startTime),
            end: new Date(event.endTime),
            resource: {
                courseCode: event.courseCode,
                courseTitle: event.courseTitle,
                location: event.location,
                lessonType: event.lessonType,
                lecturer: event.lecturerName,
                colorIndex: event.colorIndex,
                semester: event.semester,
                status: event.status,
                vtc_id: event.vtc_id,
            },
        }));

        return { success: true, data: calendarEvents };
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
        const session = await auth();
        if (!session?.user?.discordId) {
            return { success: true, data: [] }; // Not logged in, return empty
        }

        await connectDB();

        const courses = await Event.aggregate([
            { $match: { discordId: session.user.discordId } },
            {
                $group: {
                    _id: { courseCode: "$courseCode", semester: "$semester" },
                    courseTitle: { $first: "$courseTitle" },
                    colorIndex: { $first: "$colorIndex" },
                    status: { $first: "$status" },
                },
            },
            {
                $project: {
                    _id: 0,
                    courseCode: "$_id.courseCode",
                    semester: "$_id.semester",
                    courseTitle: 1,
                    colorIndex: 1,
                    status: 1,
                },
            },
            { $sort: { semester: -1, courseCode: 1 } },
        ]);

        return { success: true, data: courses };
    } catch (error) {
        console.error("Error fetching unique courses:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch courses",
        };
    }
}

// Individual class attendance record
export interface ClassRecord {
    id: string;
    date: string;
    lessonTime: string;
    attendTime: string;
    roomName: string;
    status: "attended" | "late" | "absent";
}

// Attendance stats interface
export interface AttendanceStats {
    courseCode: string;
    courseName: string;
    semester: string; // "SEM 1", "SEM 2", "SEM 3"
    status: string; // "ACTIVE", "FINISHED"
    attendRate: number;
    totalClasses: number;
    conductedClasses: number;
    attended: number;
    late: number;
    absent: number;
    isLow: boolean; // < 80%
    isFinished: boolean; // all classes conducted
    isFollowUp: boolean; // course code ends with 'A' (follow-up course)
    baseCourseCode: string; // base course code without suffix
    classes: ClassRecord[]; // detailed class records
}

// Hybrid attendance stats - combines Attendance API (what you DID) with Calendar DB (what is POSSIBLE)
export interface HybridAttendanceStats extends AttendanceStats {
    // Calendar-based counts (source of truth for totals)
    calendarTotalClasses: number;      // All scheduled classes (non-canceled)
    calendarConductedClasses: number;  // Past classes (endTime < now)
    calendarRemainingClasses: number;  // Future classes (endTime >= now)
    calendarTotalHours: number;        // Total scheduled hours
    calendarConductedHours: number;    // Past hours
    calendarRemainingHours: number;    // Future hours

    // Derived calculations
    currentAttendanceRate: number;     // (attended / calendarConductedClasses) * 100
    maxPossibleRate: number;           // ((attended + calendarRemaining) / calendarTotal) * 100
    safeToSkipCount: number;           // How many can skip and stay above 80%
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

        const attendanceRecords = await Attendance.find({ discordId: session.user.discordId })
            .sort({ courseCode: 1 })
            .lean();

        const stats: AttendanceStats[] = attendanceRecords.map((record: any) => ({
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
            classes: record.classes.map((cls: any) => ({
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

        // Step 1: Fetch attendance records from Attendance DB
        const attendanceRecords = await Attendance.find({ discordId })
            .sort({ courseCode: 1 })
            .lean();

        // Step 2: For each course, get calendar-based counts from Event DB
        const hybridStats: HybridAttendanceStats[] = await Promise.all(
            attendanceRecords.map(async (record: any) => {
                const courseCode = record.courseCode;
                const baseCourseCode = record.baseCourseCode || courseCode;

                // Query calendar events for this course (match both courseCode and baseCourseCode)
                const calendarEvents = await Event.find({
                    discordId,
                    $or: [
                        { courseCode: courseCode },
                        { courseCode: baseCourseCode },
                    ],
                    status: { $ne: "CANCELED" } // Exclude canceled events
                }).lean();

                // Calculate calendar-based counts
                let calendarTotalClasses = 0;
                let calendarConductedClasses = 0;
                let calendarRemainingClasses = 0;
                let calendarTotalHours = 0;
                let calendarConductedHours = 0;
                let calendarRemainingHours = 0;

                for (const event of calendarEvents) {
                    const startTime = new Date(event.startTime);
                    const endTime = new Date(event.endTime);
                    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

                    // Count all non-canceled events
                    calendarTotalClasses++;
                    calendarTotalHours += durationHours;

                    // Separate conducted (past) vs remaining (future)
                    if (endTime < now) {
                        calendarConductedClasses++;
                        calendarConductedHours += durationHours;
                    } else {
                        calendarRemainingClasses++;
                        calendarRemainingHours += durationHours;
                    }
                }

                // Step 3: Calculate derived stats
                const attended = record.attended || 0;

                // Current rate based on conducted classes from calendar
                const currentAttendanceRate = calendarConductedClasses > 0
                    ? (attended / calendarConductedClasses) * 100
                    : 0;

                // Max possible rate if attend all remaining classes
                const maxPossibleRate = calendarTotalClasses > 0
                    ? ((attended + calendarRemainingClasses) / calendarTotalClasses) * 100
                    : 0;

                // Calculate safe to skip count
                // Formula: How many remaining classes can skip and stay >= 80%?
                // (attended + (remaining - x)) / total >= 0.80
                // x <= attended + remaining - (0.80 * total)
                let safeToSkipCount = 0;
                if (calendarTotalClasses > 0) {
                    const requiredAttendance = Math.ceil(calendarTotalClasses * 0.8);
                    const potentialTotal = attended + calendarRemainingClasses;
                    safeToSkipCount = Math.max(0, potentialTotal - requiredAttendance);
                }

                // Step 4: Handle class records - generate from calendar if no API data
                let classes: ClassRecord[];

                // Has API data - use it
                classes = record.classes.map((cls: any) => ({
                    id: cls.id,
                    date: cls.date,
                    lessonTime: cls.lessonTime,
                    attendTime: cls.attendTime,
                    roomName: cls.roomName,
                    status: cls.status as "attended" | "late" | "absent",
                }));


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
                    isLow: currentAttendanceRate < 80,
                    isFinished: record.isFinished,
                    isFollowUp: record.isFollowUp,
                    baseCourseCode: record.baseCourseCode || courseCode,
                    classes,

                    // New calendar-based fields
                    calendarTotalClasses,
                    calendarConductedClasses,
                    calendarRemainingClasses,
                    calendarTotalHours: Math.round(calendarTotalHours * 10) / 10,
                    calendarConductedHours: Math.round(calendarConductedHours * 10) / 10,
                    calendarRemainingHours: Math.round(calendarRemainingHours * 10) / 10,

                    // Derived calculations
                    currentAttendanceRate: Math.round(currentAttendanceRate * 10) / 10,
                    maxPossibleRate: Math.round(maxPossibleRate * 10) / 10,
                    safeToSkipCount,
                };

                return hybridStat;
            })
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
                        // Only count conducted classes (those with valid data)
                        totalConducted++;

                        let status: "attended" | "late" | "absent" = "absent";

                        if (cls.attendTime === "-" || !cls.attendTime) {
                            // Not attended
                            absent++;
                            status = "absent";
                        } else if (cls.status === 3) {
                            // Late (but still attended)
                            late++;
                            attended++;
                            status = "late";
                        } else if (cls.status === 1) {
                            // On time
                            attended++;
                            status = "attended";
                        } else {
                            // Any other status with attendTime - count as attended
                            if (cls.attendTime && cls.attendTime !== "-") {
                                attended++;
                                status = "attended";
                            } else {
                                absent++;
                                status = "absent";
                            }
                        }

                        // Add to class records
                        classRecords.push({
                            id: cls.id,
                            date: cls.date,
                            lessonTime: cls.lessonTime,
                            attendTime: cls.attendTime,
                            roomName: cls.roomName,
                            status,
                        });
                    }

                    // Calculate attendance rate (attended) / total * 100
                    calculatedRate = totalConducted > 0
                        ? (attended / totalConducted) * 100
                        : 0;
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
                const isFollowUp = /[A-Z]$/.test(course.courseCode) && course.courseCode.match(/[A-Z]$/)?.[0] === 'A';
                const baseCourseCode = isFollowUp ? course.courseCode.slice(0, -1) : course.courseCode;

                // Ensure we have valid numbers
                const finalRate = isNaN(calculatedRate) ? (course.attendRate || 0) : calculatedRate;

                return {
                    courseCode: course.courseCode,
                    courseName: course.name?.en || course.courseCode,
                    semester: "SEM 2", // Default for real-time API fetch
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
            })
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


// Keep the legacy function for backward compatibility
export async function fetchTimetable(
    token: string,
    semesterNum: number = 2
): Promise<{ success: boolean; data?: TimetableEvent[]; error?: string }> {
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
                const response = (await api.getTimeTableAndReminderList(
                    month,
                    effectiveYear
                )) as VtcApiResponse;

                if (!response.isSuccess) {
                    console.warn(`API error for month ${month}:`, response.errorMsg);
                    continue;
                }

                const rawList = response.payload?.timetable?.add || [];
                lectureList.push(...rawList);
            } catch (err) {
                console.error(
                    `Error processing month ${month}:`,
                    err instanceof Error ? err.message : err
                );
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

/**
 * Export semester-specific events as ICS string
 * Fetches all events for the specified semester and generates ICS format
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
        const discordId = session.user.discordId;

        // Step 2: Validate semester
        const validSemesters = ["SEM 1", "SEM 2", "SEM 3"];
        if (!validSemesters.includes(semester)) {
            return { success: false, error: "Invalid semester. Use 'SEM 1', 'SEM 2', or 'SEM 3'." };
        }

        // Step 3: Connect and fetch events
        await connectDB();
        const events = await Event.find({ discordId, semester })
            .sort({ startTime: 1 })
            .lean();

        if (events.length === 0) {
            return { success: false, error: `No events found for ${semester}.` };
        }

        // Step 4: Generate ICS string
        const { createEvents } = await import("ics");
        type EventAttributes = import("ics").EventAttributes;

        // Helper to convert Date to ICS date array format
        const getDateArray = (date: Date): [number, number, number, number, number] => [
            date.getFullYear(),
            date.getMonth() + 1, // ICS months are 1-indexed
            date.getDate(),
            date.getHours(),
            date.getMinutes(),
        ];

        const icsEvents: EventAttributes[] = events.map((event: any) => ({
            uid: `${event.vtc_id}@vtc-timetable`,
            title: `${event.courseTitle} (${event.courseCode})`,
            start: getDateArray(new Date(event.startTime)),
            end: getDateArray(new Date(event.endTime)),
            location: event.location || undefined,
            description: [
                event.lessonType ? `Type: ${event.lessonType}` : "",
                event.lecturerName ? `Lecturer: ${event.lecturerName}` : "",
                `Semester: ${event.semester}`,
            ]
                .filter(Boolean)
                .join("\n"),
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

/**
 * Update start/end time of a specific event
 */
export async function updateEventDetails(eventId: string, newStart: Date, newEnd: Date) {
    try {
        const session = await auth();
        if (!session?.user?.discordId) return { success: false, error: "Unauthorized" };

        await connectDB();
        await Event.findOneAndUpdate(
            { vtc_id: eventId, discordId: session.user.discordId },
            { startTime: newStart, endTime: newEnd },
            { new: true }
        );

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
        const session = await auth();
        if (!session?.user?.discordId) return { success: false, error: "Unauthorized" };

        await connectDB();
        await Event.findOneAndUpdate(
            { vtc_id: eventId, discordId: session.user.discordId },
            { status },
            { new: true }
        );

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to set status" };
    }
}

/**
 * Mark all future events of a course as FINISHED
 */
export async function finishCourseEarly(courseCode: string, semester: string) {
    try {
        const session = await auth();
        if (!session?.user?.discordId) return { success: false, error: "Unauthorized" };

        await connectDB();
        const now = new Date();

        await Event.updateMany(
            {
                courseCode,
                discordId: session.user.discordId,
                semester,
                startTime: { $gt: now }
            },
            { status: "FINISHED" }
        );

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Failed to finish course" };
    }
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
            // Default to Spring semester (2) if not specified
            return await syncVtcData(user.vtcToken, 2);
        }

        return { success: true, message: "Sync not needed yet" };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Background sync failed" };
    }
}
