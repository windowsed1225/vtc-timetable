// Individual class attendance record
export interface ClassRecord {
    id: string;
    date: string;
    lessonTime: string;
    attendTime: string;
    roomName: string;
    actualDuration?: number;
    status: "attended" | "late" | "absent";
}

// Attendance stats interface
export interface AttendanceStats {
    courseCode: string;
    courseName: string;
    semester: string;
    status: string;
    attendRate: number;
    totalClasses: number;
    conductedClasses: number;
    attended: number;
    late: number;
    absent: number;
    isLow: boolean;
    isFinished: boolean;
    isFollowUp: boolean;
    baseCourseCode: string;
    classes: ClassRecord[];
    gracePeriodThreshold: number;
}

export interface HybridAttendanceStats extends AttendanceStats {
    calendarTotalClasses: number;
    calendarConductedClasses: number;
    calendarRemainingClasses: number;
    calendarTotalHours: number;
    calendarConductedHours: number;
    calendarRemainingHours: number;
    totalAttendedMinutes: number;
    totalConductedMinutes: number;
    totalSemesterMinutes: number;
    totalRemainingMinutes: number;
    currentAttendanceRate: number;
    maxPossibleRate: number;
    minutesAttendanceRate: number;
    maxPossibleMinutesRate: number;
    safeToSkipCount: number;
    safeToSkipMinutes: number;
    recoveryStatus: "safe" | "recoverable" | "failed" | "grace";
    displaySemester?: string;
    currentSemesterStats?: {
        semester: string;
        attended: number;
        conductedClasses: number;
        attendanceRate: number;
    };
    semesterBreakdowns?: Record<string, {
        attended: number;
        conductedClasses: number;
        attendanceRate: number;
        calendarTotalClasses: number;
        calendarTotalHours?: number;
    }>;
}

export interface TimetableData {
    add: import("@/types/timetable").TimetableEvent[];
    delete: unknown[];
    update: unknown[];
}

export interface VtcApiResponse {
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
