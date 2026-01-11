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
        const token = extractToken(vtcUrl);
        if (!token) {
            return { success: false, error: "Invalid VTC URL. No token found." };
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
            { vtcToken: token, vtcStudentId },
            { upsert: true }
        );

        // Step 5: Fetch and save Timetable with both IDs
        const months = SEMESTER_MAP[semesterNum];
        if (!months) {
            return {
                success: false,
                error: "Invalid semester number. Use 1 (Fall), 2 (Spring), or 3 (Summer).",
            };
        }

        const currentYear = new Date().getFullYear();
        let newEventsCount = 0;

        for (const month of months) {
            // Determine year based on semester
            const year = semesterNum === 1 && month >= 9 ? currentYear : currentYear;

            const response = await api.getTimeTableAndReminderList(month, year);

            if (response.isSuccess && response.payload?.timetable?.add) {
                const events = response.payload.timetable.add;

                // Prepare bulk operations with discordId and vtcStudentId
                const bulkOps = events.map((event: TimetableEvent) => ({
                    updateOne: {
                        filter: { vtc_id: event.id, discordId },
                        update: {
                            $set: {
                                discordId,
                                vtcStudentId,
                                vtc_id: event.id,
                                courseCode: event.courseCode,
                                courseTitle: event.courseTitle,
                                lessonType: event.lessonType || "",
                                startTime: new Date(event.startTime * 1000),
                                endTime: new Date(event.endTime * 1000),
                                location: `${event.campusCode || ""}-${event.roomNum || ""}`.replace(/^-|-$/g, ""),
                                lecturerName: event.lecturerName || "",
                                colorIndex: getColorIndex(event.courseCode),
                            },
                        },
                        upsert: true,
                    },
                }));

                if (bulkOps.length > 0) {
                    const result = await Event.bulkWrite(bulkOps);
                    newEventsCount += result.upsertedCount;
                }
            }
        }

        // Step 6: Fetch and save Attendance with both IDs
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

        const calendarEvents: CalendarEvent[] = events.map((event) => ({
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
    data?: Array<{ courseCode: string; courseTitle: string; colorIndex: number }>;
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
                    _id: "$courseCode",
                    courseTitle: { $first: "$courseTitle" },
                    colorIndex: { $first: "$colorIndex" },
                },
            },
            {
                $project: {
                    _id: 0,
                    courseCode: "$_id",
                    courseTitle: 1,
                    colorIndex: 1,
                },
            },
            { $sort: { courseCode: 1 } },
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

        const stats: AttendanceStats[] = attendanceRecords.map((record) => ({
            courseCode: record.courseCode,
            courseName: record.courseName,
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
