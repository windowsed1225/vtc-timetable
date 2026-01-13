"use client";

import { useState, useMemo } from "react";
import { HybridAttendanceStats, deduplicateData } from "@/app/actions";
import { PASTEL_COLORS } from "@/lib/colors";
import { CalendarEvent } from "@/types/timetable";
import AttendanceModal from "./AttendanceModal";
import SemesterSummaryCard from "./SemesterSummaryCard";
import CourseDetailsModal from "./CourseDetailsModal";
import SubscribeButton from "./SubscribeButton";
import ExportSemesterButton from "./ExportSemesterButton";
import SkippingCalculator from "./SkippingCalculator";
import { calculateSkippingStats } from "@/lib/attendance-logic";

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
    attendance: HybridAttendanceStats[];
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
        discordId?: string | null;
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
    const [selectedCourse, setSelectedCourse] = useState<HybridAttendanceStats | null>(null);
    const [selectedCourseInfo, setSelectedCourseInfo] = useState<CourseInfo | null>(null);
    const [calculatingCourse, setCalculatingCourse] = useState<HybridAttendanceStats | null>(null);


    // Global Attendance Stats (Current Semester only) - Using class counts
    const globalStats = useMemo(() => {
        let totalAttended = 0;
        let totalConducted = 0;
        let totalClasses = 0;
        let totalRemaining = 0;
        let hasActive = false;

        attendance.forEach(course => {
            if (course.status === "ACTIVE") {
                totalAttended += course.attended || 0;
                totalConducted += course.calendarConductedClasses || 0;
                totalClasses += course.calendarTotalClasses || 0;
                totalRemaining += course.calendarRemainingClasses || 0;
                hasActive = true;
            }
        });

        // Calculate rates
        const currentRate = totalConducted > 0
            ? (totalAttended / totalConducted) * 100
            : 100;
        const maxPossibleRate = totalClasses > 0
            ? ((totalAttended + totalRemaining) / totalClasses) * 100
            : 100;

        // Color coding
        let colorClass = "text-green-500";
        let bgClass = "bg-green-500";
        if (currentRate < 80) {
            colorClass = "text-red-500";
            bgClass = "bg-red-500";
        } else if (currentRate < 90) {
            colorClass = "text-yellow-500";
            bgClass = "bg-yellow-500";
        }

        return {
            attended: totalAttended,
            conducted: totalConducted,
            total: totalClasses,
            remaining: totalRemaining,
            currentRate: Math.round(currentRate * 10) / 10,
            maxPossibleRate: Math.round(maxPossibleRate * 10) / 10,
            colorClass,
            bgClass,
            hasActive
        };
    }, [attendance]);


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
            .sort(([a], [b]) => (SEMESTER_ORDER[b] || 0) - (SEMESTER_ORDER[a] || 0)) as [string, { courses: CourseInfo[]; hasActive: boolean }][];
    }, [courses]);

    // Group attendance by semester and determine initial expand state
    const groupedAttendance = useMemo(() => {
        const groups: Record<string, { items: HybridAttendanceStats[]; hasActive: boolean }> = {};

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
            .sort(([a], [b]) => (SEMESTER_ORDER[b] || 0) - (SEMESTER_ORDER[a] || 0)) as [string, { items: HybridAttendanceStats[]; hasActive: boolean }][];
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
        groupedCourses.forEach(([sem, data]: [string, { courses: CourseInfo[]; hasActive: boolean }]) => {
            initial[`cal-${sem}`] = data.hasActive;
        });
        return initial;
    });

    const [expandedAttendance, setExpandedAttendance] = useState<Record<string, boolean>>(() => {
        const initial: Record<string, boolean> = {};
        groupedAttendance.forEach(([sem, data]: [string, { items: HybridAttendanceStats[]; hasActive: boolean }]) => {
            initial[`att-${sem}`] = data.hasActive;
        });
        return initial;
    });

    const toggleCalendar = (sem: string) => {
        setExpandedCalendars((prev: Record<string, boolean>) => ({ ...prev, [`cal-${sem}`]: !prev[`cal-${sem}`] }));
    };

    const toggleAttendance = (sem: string) => {
        setExpandedAttendance((prev: Record<string, boolean>) => ({ ...prev, [`att-${sem}`]: !prev[`att-${sem}`] }));
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

                            {/* Current Status Dashboard - Hero Card */}
                            {globalStats.hasActive && (
                                <div className="mb-4 p-4 bg-[var(--calendar-header-bg)] rounded-xl border border-[var(--calendar-border)]">
                                    {/* Big Percentage Number */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Current Standing</span>
                                        <span className={`text-3xl font-bold ${globalStats.colorClass}`}>
                                            {globalStats.currentRate.toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full h-2 bg-[var(--calendar-border)] rounded-full overflow-hidden mb-2">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${globalStats.bgClass}`}
                                            style={{ width: `${Math.min(globalStats.currentRate, 100)}%` }}
                                        />
                                    </div>

                                    {/* Sub-text */}
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Attended <span className="font-medium">{globalStats.attended}</span> out of <span className="font-medium">{globalStats.conducted}</span> classes conducted
                                    </p>
                                    <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                                        Max possible: {globalStats.maxPossibleRate.toFixed(1)}% • {globalStats.remaining} classes remaining
                                    </p>
                                </div>
                            )}

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
                                                            const rate = course.minutesAttendanceRate ?? course.currentAttendanceRate ?? 0;
                                                            const maxRate = course.maxPossibleMinutesRate ?? course.maxPossibleRate ?? 100;
                                                            const attended = course.attended || 0;
                                                            const totalClasses = course.calendarTotalClasses || 0;
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
                                                                            {/* Recovery Status Badge */}
                                                                            {!isFinished && course.recoveryStatus === "recoverable" && (
                                                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                                                    Recoverable ⚠️
                                                                                </span>
                                                                            )}
                                                                            {!isFinished && course.recoveryStatus === "failed" && (
                                                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                                                                    Failed ❌
                                                                                </span>
                                                                            )}
                                                                            {course.isFollowUp && (
                                                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                                                                    Follow-up
                                                                                </span>
                                                                            )}
                                                                            {isFinished && (
                                                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                                                                    Finished
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span
                                                                            className={`text-sm font-semibold ml-2 ${
                                                                                // Grace period: use neutral yellow instead of alarming red
                                                                                course.recoveryStatus === "grace"
                                                                                    ? "text-yellow-500"
                                                                                    : rate < 80
                                                                                        ? "text-red-500"
                                                                                        : rate < 90
                                                                                            ? "text-yellow-500"
                                                                                            : "text-green-500"
                                                                                }`}
                                                                        >
                                                                            {rate.toFixed(1)}%
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full h-1.5 bg-[var(--calendar-border)] rounded-full overflow-hidden mb-1.5">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-500 ${rate < 80 ? "bg-red-500" : rate < 90 ? "bg-yellow-500" : "bg-green-500"}`}
                                                                            style={{
                                                                                width: `${Math.min(rate, 100)}%`,
                                                                                filter: isFinished ? "grayscale(50%)" : "none",
                                                                            }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
                                                                        <span>{attended} / {totalClasses} classes</span>
                                                                        <span className="text-gray-400">Max: {maxRate.toFixed(0)}%</span>
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

                    {/* Export Semester ICS - show for each semester with courses */}
                    {groupedCourses.length > 0 && (
                        <div className="space-y-2">
                            {groupedCourses.map(([semester]) => (
                                <ExportSemesterButton
                                    key={`export-${semester}`}
                                    semester={semester}
                                />
                            ))}
                        </div>
                    )}

                    {/* Calendar Subscription - auto-detects current semester */}
                    {user?.discordId && (
                        <SubscribeButton discordId={user.discordId} />
                    )}
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
                    attendance={attendance.find(a =>
                        a.courseCode === selectedCourseInfo.courseCode ||
                        a.baseCourseCode === selectedCourseInfo.courseCode ||
                        selectedCourseInfo.courseCode.startsWith(a.courseCode) ||
                        a.courseCode.startsWith(selectedCourseInfo.courseCode)
                    ) || null}
                    onClose={() => setSelectedCourseInfo(null)}
                />
            )}

        </>
    );
}
