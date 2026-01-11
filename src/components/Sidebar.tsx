"use client";

import { useState, useMemo } from "react";
import { AttendanceStats } from "@/app/actions";
import { PASTEL_COLORS } from "@/lib/colors";
import { CalendarEvent } from "@/types/timetable";
import AttendanceModal from "./AttendanceModal";
import SemesterSummaryCard from "./SemesterSummaryCard";
import CourseDetailsModal from "./CourseDetailsModal";

// Semester display names
const SEMESTER_LABELS: Record<string, string> = {
    "SEM 1": "Semester 1 (Fall)",
    "SEM 2": "Semester 2 (Spring)",
    "SEM 3": "Semester 3 (Summer)",
};

// Semester sort order (newest first)
const SEMESTER_ORDER: Record<string, number> = {
    "SEM 3": 3,
    "SEM 2": 2,
    "SEM 1": 1,
};

interface CourseInfo {
    courseCode: string;
    courseTitle: string;
    colorIndex: number;
    semester: string;
    status: string;
}

interface SidebarProps {
    courses: CourseInfo[];
    events: CalendarEvent[];
    attendance: AttendanceStats[];
    onSyncClick: () => void;
    onExportClick: () => void;
    onSignIn: () => void;
    onSignOut: () => void;
    onRefreshAttendance: () => void;
    onRefreshCalendar: () => void;
    isSyncing: boolean;
    isRefreshingAttendance: boolean;
    isRefreshingCalendar: boolean;
    vtcUrl: string;
    user?: {
        name?: string | null;
        image?: string | null;
    } | null;
    sidebarOpen?: boolean;
}

export default function Sidebar({
    courses,
    events,
    attendance,
    onSyncClick,
    onExportClick,
    onSignIn,
    onSignOut,
    onRefreshAttendance,
    onRefreshCalendar,
    isSyncing,
    isRefreshingAttendance,
    isRefreshingCalendar,
    user,
    sidebarOpen,
}: SidebarProps) {
    const [selectedCourse, setSelectedCourse] = useState<AttendanceStats | null>(null);
    const [selectedCourseInfo, setSelectedCourseInfo] = useState<CourseInfo | null>(null);

    // Group courses by semester and determine initial expand state
    const groupedCourses = useMemo(() => {
        const groups: Record<string, { courses: CourseInfo[]; hasActive: boolean }> = {};

        for (const course of courses) {
            const sem = course.semester || "SEM 2";
            if (!groups[sem]) {
                groups[sem] = { courses: [], hasActive: false };
            }
            groups[sem].courses.push(course);
            if (course.status === "UPCOMING") {
                groups[sem].hasActive = true;
            }
        }

        // Sort by semester order (newest first)
        return Object.entries(groups)
            .sort(([a], [b]) => (SEMESTER_ORDER[b] || 0) - (SEMESTER_ORDER[a] || 0));
    }, [courses]);

    // Group attendance by semester and determine initial expand state
    const groupedAttendance = useMemo(() => {
        const groups: Record<string, { items: AttendanceStats[]; hasActive: boolean }> = {};

        for (const item of attendance) {
            const sem = item.semester || "SEM 2";
            if (!groups[sem]) {
                groups[sem] = { items: [], hasActive: false };
            }
            groups[sem].items.push(item);
            if (item.status === "ACTIVE") {
                groups[sem].hasActive = true;
            }
        }

        // Sort by semester order (newest first)
        return Object.entries(groups)
            .sort(([a], [b]) => (SEMESTER_ORDER[b] || 0) - (SEMESTER_ORDER[a] || 0));
    }, [attendance]);

    // Group events by semester for summary cards
    const eventsBySemester = useMemo(() => {
        const groups: Record<string, CalendarEvent[]> = {};

        for (const event of events) {
            const sem = event.resource?.semester || "SEM 2";
            if (!groups[sem]) {
                groups[sem] = [];
            }
            groups[sem].push(event);
        }

        return groups;
    }, [events]);

    // Track expanded state for each semester accordion
    const [expandedCalendars, setExpandedCalendars] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        groupedCourses.forEach(([sem, data]) => {
            initial[`cal-${sem}`] = data.hasActive;
        });
        return initial;
    });

    const [expandedAttendance, setExpandedAttendance] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        groupedAttendance.forEach(([sem, data]) => {
            initial[`att-${sem}`] = data.hasActive;
        });
        return initial;
    });

    const toggleCalendar = (sem: string) => {
        setExpandedCalendars(prev => ({ ...prev, [`cal-${sem}`]: !prev[`cal-${sem}`] }));
    };

    const toggleAttendance = (sem: string) => {
        setExpandedAttendance(prev => ({ ...prev, [`att-${sem}`]: !prev[`att-${sem}`] }));
    };

    // Chevron icon component
    const ChevronIcon = ({ isExpanded }: { isExpanded: boolean }) => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
        >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
    );

    return (
        <>
            <aside className={`glass w-[280px] min-w-[280px] h-full flex flex-col border-r border-[var(--sidebar-border)] overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`}>
                {/* Header */}
                <div className="p-4 border-b border-[var(--sidebar-border)]">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
                        {user ? (
                            <button
                                onClick={onSignOut}
                                className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
                                title="Sign out"
                            >
                                {user.image && (
                                    <img
                                        src={user.image}
                                        alt={user.name || "User"}
                                        className="w-6 h-6 rounded-full"
                                    />
                                )}
                            </button>
                        ) : (
                            <button
                                onClick={onSignIn}
                                className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
                            >
                                Sign In
                            </button>
                        )}
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* My Calendars Section */}
                    <section>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                My Calendars
                            </h2>
                            <button
                                onClick={onRefreshCalendar}
                                disabled={isRefreshingCalendar}
                                className="p-1 rounded hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50"
                                title="Refresh calendar from database"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className={`w-4 h-4 text-[var(--text-tertiary)] ${isRefreshingCalendar ? "animate-spin" : ""}`}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                                    />
                                </svg>
                            </button>
                        </div>

                        {courses.length === 0 ? (
                            <p className="text-sm text-[var(--text-tertiary)]">
                                No courses synced yet
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {/* Semester Course Lists */}
                                {groupedCourses.map(([semester, data]) => {
                                    const isExpanded = expandedCalendars[`cal-${semester}`] ?? data.hasActive;
                                    const isFinishedSemester = !data.hasActive;

                                    return (
                                        <div key={semester}>
                                            {/* Semester Header */}
                                            <button
                                                onClick={() => toggleCalendar(semester)}
                                                className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors ${isFinishedSemester ? "text-[var(--text-tertiary)]" : "text-[var(--foreground)]"}`}
                                            >
                                                <ChevronIcon isExpanded={isExpanded} />
                                                <span className="text-xs font-medium">
                                                    {SEMESTER_LABELS[semester] || semester}
                                                </span>
                                                <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                                                    {data.courses.length}
                                                </span>
                                            </button>

                                            {/* Semester Courses & Summary */}
                                            {isExpanded && (
                                                <div className="ml-5 mt-1 space-y-2 animate-fadeIn">
                                                    {/* Semester Summary Card */}
                                                    {(eventsBySemester[semester] || []).length > 0 && (
                                                        <SemesterSummaryCard
                                                            events={eventsBySemester[semester] || []}
                                                            semesterLabel={SEMESTER_LABELS[semester] || semester}
                                                        />
                                                    )}
                                                    {/* Course List */}
                                                    {data.courses.map((course) => (
                                                        <button
                                                            key={`${course.courseCode}-${course.semester}`}
                                                            onClick={() => setSelectedCourseInfo(course)}
                                                            className={`w-full flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors cursor-pointer text-left ${course.status === "FINISHED" ? "opacity-60" : ""}`}
                                                        >
                                                            <div
                                                                className="color-dot"
                                                                style={{
                                                                    backgroundColor: PASTEL_COLORS[course.colorIndex] || PASTEL_COLORS[0],
                                                                    filter: course.status === "FINISHED" ? "grayscale(50%)" : "none",
                                                                }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium truncate">
                                                                    {course.courseCode}
                                                                </p>
                                                                <p className="text-xs text-[var(--text-tertiary)] truncate">
                                                                    {course.courseTitle}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* Attendance Section */}
                    {user && (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Attendance
                                </h2>
                                <button
                                    onClick={onRefreshAttendance}
                                    disabled={isRefreshingAttendance}
                                    className="p-1 rounded hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-50"
                                    title="Refresh attendance from VTC"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className={`w-4 h-4 text-[var(--text-tertiary)] ${isRefreshingAttendance ? "animate-spin" : ""}`}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                                        />
                                    </svg>
                                </button>
                            </div>

                            {attendance.length === 0 ? (
                                <p className="text-sm text-[var(--text-tertiary)]">
                                    No attendance data. Sync your schedule first.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {groupedAttendance.map(([semester, data]) => {
                                        const isExpanded = expandedAttendance[`att-${semester}`] ?? data.hasActive;
                                        const isFinishedSemester = !data.hasActive;

                                        return (
                                            <div key={semester}>
                                                {/* Semester Header */}
                                                <button
                                                    onClick={() => toggleAttendance(semester)}
                                                    className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors ${isFinishedSemester ? "text-[var(--text-tertiary)]" : "text-[var(--foreground)]"}`}
                                                >
                                                    <ChevronIcon isExpanded={isExpanded} />
                                                    <span className="text-xs font-medium">
                                                        {SEMESTER_LABELS[semester] || semester}
                                                    </span>
                                                    <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                                                        {data.items.length}
                                                    </span>
                                                </button>

                                                {/* Semester Attendance */}
                                                {isExpanded && (
                                                    <div className="ml-5 mt-1 space-y-1 animate-fadeIn">
                                                        {data.items.map((course) => {
                                                            const rate = course.attendRate ?? 0;
                                                            const attended = course.attended ?? 0;
                                                            const late = course.late ?? 0;
                                                            const absent = course.absent ?? 0;
                                                            const onTime = attended - late;
                                                            const conducted = course.conductedClasses ?? 0;
                                                            const total = course.totalClasses ?? 0;
                                                            const isFinished = course.status === "FINISHED";

                                                            return (
                                                                <button
                                                                    key={`${course.courseCode}-${course.semester}`}
                                                                    onClick={() => setSelectedCourse(course)}
                                                                    className={`w-full py-2 px-2 rounded-lg hover:bg-[rgba(0,0,0,0.03)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors text-left ${isFinished ? "opacity-60" : ""}`}
                                                                >
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="text-sm font-medium truncate flex-1">
                                                                            {course.courseCode}
                                                                        </span>
                                                                        <div className="flex items-center gap-1">
                                                                            {course.isFollowUp && (
                                                                                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                                                                    Follow-up
                                                                                </span>
                                                                            )}
                                                                            {isFinished && (
                                                                                <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                                                                    Finished
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span
                                                                            className={`text-sm font-semibold ml-2 ${course.isLow ? "text-red-500" : "text-green-500"}`}
                                                                        >
                                                                            {rate.toFixed(1)}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-[var(--calendar-border)] rounded-full overflow-hidden mb-1.5">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-500 ${course.isLow ? "bg-red-500" : "bg-green-500"}`}
                                                                            style={{
                                                                                width: `${Math.min(rate, 100)}%`,
                                                                                filter: isFinished ? "grayscale(50%)" : "none",
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                                                                        <span className="text-green-600">✓ {onTime}</span>
                                                                        {late > 0 && (
                                                                            <span className="text-yellow-600">⏱ {late}</span>
                                                                        )}
                                                                        {absent > 0 && (
                                                                            <span className="text-red-500">✗ {absent}</span>
                                                                        )}
                                                                        <span className="ml-auto">{conducted}/{total} classes</span>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-[var(--sidebar-border)] space-y-2">
                    <button
                        onClick={onSyncClick}
                        disabled={isSyncing}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {isSyncing ? (
                            <>
                                <svg
                                    className="animate-spin h-4 w-4"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                Syncing...
                            </>
                        ) : (
                            <>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-4 h-4"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                                    />
                                </svg>
                                Sync Schedule
                            </>
                        )}
                    </button>

                    <button
                        onClick={onExportClick}
                        className="btn-secondary w-full flex items-center justify-center gap-2"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-4 h-4"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                            />
                        </svg>
                        Export ICS
                    </button>
                </div>
            </aside>

            {/* Attendance Detail Modal */}
            {selectedCourse && (
                <AttendanceModal
                    course={selectedCourse}
                    onClose={() => setSelectedCourse(null)}
                />
            )}

            {/* Course Details Modal */}
            {selectedCourseInfo && (
                <CourseDetailsModal
                    courseCode={selectedCourseInfo.courseCode}
                    courseTitle={selectedCourseInfo.courseTitle}
                    colorIndex={selectedCourseInfo.colorIndex}
                    events={events}
                    onClose={() => setSelectedCourseInfo(null)}
                />
            )}
        </>
    );
}
