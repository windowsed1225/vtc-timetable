"use client";

import { CalendarEvent } from "@/types/timetable";
import { PASTEL_COLORS } from "@/lib/colors";
import dayjs from "dayjs";

interface CourseDetailsModalProps {
    courseCode: string;
    courseTitle: string;
    colorIndex: number;
    events: CalendarEvent[];
    onClose: () => void;
}

export default function CourseDetailsModal({
    courseCode,
    courseTitle,
    colorIndex,
    events,
    onClose,
}: CourseDetailsModalProps) {
    // Filter events for this specific course
    const courseEvents = events.filter(
        (e) => e.resource?.courseCode === courseCode
    );

    // Calculate future classes (from now onwards)
    const now = new Date();
    const futureClasses = courseEvents.filter((e) => e.start > now);

    // Calculate total hours for future classes
    const futureMilliseconds = futureClasses.reduce((acc, event) => {
        const duration = event.end.getTime() - event.start.getTime();
        return acc + duration;
    }, 0);
    const futureHours = (futureMilliseconds / (1000 * 60 * 60)).toFixed(1);

    // Calculate total hours for all classes
    const totalMilliseconds = courseEvents.reduce((acc, event) => {
        const duration = event.end.getTime() - event.start.getTime();
        return acc + duration;
    }, 0);
    const totalHours = (totalMilliseconds / (1000 * 60 * 60)).toFixed(1);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start gap-3 mb-4">
                    <div
                        className="w-4 h-4 rounded-full mt-1 flex-shrink-0"
                        style={{ backgroundColor: PASTEL_COLORS[colorIndex] || PASTEL_COLORS[0] }}
                    />
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold">{courseCode}</h2>
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                            {courseTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn-icon -mt-1 -mr-2"
                        aria-label="Close"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Future Classes */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-100 dark:border-green-900/50">
                        <p className="text-2xl font-bold text-[var(--foreground)]">
                            {futureClasses.length}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Future {futureClasses.length === 1 ? "Class" : "Classes"}
                        </p>
                    </div>

                    {/* Future Hours */}
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50">
                        <p className="text-2xl font-bold text-[var(--foreground)]">
                            {futureHours}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                            Hours Remaining
                        </p>
                    </div>
                </div>

                {/* Summary Row */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.03)]">
                    <span className="text-sm text-[var(--text-secondary)]">Total scheduled</span>
                    <span className="text-sm font-medium">
                        {courseEvents.length} classes • {totalHours} hours
                    </span>
                </div>

                {/* Upcoming Classes List */}
                {futureClasses.length > 0 && (
                    <div className="mt-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
                            Upcoming Classes
                        </h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {futureClasses.slice(0, 5).map((event, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)]"
                                >
                                    <div>
                                        <p className="text-sm font-medium">
                                            {dayjs(event.start).format("ddd, MMM D")}
                                        </p>
                                        <p className="text-xs text-[var(--text-tertiary)]">
                                            {dayjs(event.start).format("h:mm A")} - {dayjs(event.end).format("h:mm A")}
                                        </p>
                                    </div>
                                    {event.resource?.location && (
                                        <span className="text-xs text-[var(--text-tertiary)]">
                                            📍 {event.resource.location}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {futureClasses.length > 5 && (
                                <p className="text-xs text-[var(--text-tertiary)] text-center py-1">
                                    +{futureClasses.length - 5} more classes
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
