/**
 * Barrel re-export — all public actions and types.
 *
 * Consumers can continue to import from "@/app/actions" without changes.
 * Each module lives in its own file for maintainability.
 */

// ── Types ────────────────────────────────────────────
export type { AttendanceStats, ClassRecord, HybridAttendanceStats } from "./types";

// ── Sync ─────────────────────────────────────────────
export {
	autoSyncFromStoredToken,
	checkAndSyncBackground,
	fetchTimetable,
	finalizeAttendanceSync,
	listAttendanceCoursesStored,
	prepareVtcSync,
	shouldAutoSync,
	syncCourseAttendanceStored,
	syncSemesterFromStoredToken,
	syncSemesterTimetableStored,
	syncTimetable,
	syncVtcData,
} from "./sync";

// ── Attendance ───────────────────────────────────────
export {
	deduplicateData,
	getAttendance,
	getCourseHoursBreakdown,
	getHybridAttendanceStats,
	getStoredAttendance,
	refreshAttendance,
	toggleEventAttendance,
} from "./attendance";

// ── Events ───────────────────────────────────────────
export {
	deleteEventsByDateRange,
	finishCourseEarly,
	getStoredEvents,
	getUniqueCourses,
	previewDeleteEventsByDateRange,
	setEventStatus,
	updateEventActualTimeAction,
	updateEventDetails,
} from "./events";

// ── Export ────────────────────────────────────────────
export { exportSemesterIcs } from "./export";

// ── Moodle ───────────────────────────────────────────
export { getMoodleDeadlines } from "./moodle";

// ── User ─────────────────────────────────────────────
export { checkStoredToken, getPrintQuota, registerEcard, saveUserLocale } from "./user";

// ── Settings ─────────────────────────────────────────
export { clearVtcData, getUserSettings, updateEmailPassword } from "./settings";
