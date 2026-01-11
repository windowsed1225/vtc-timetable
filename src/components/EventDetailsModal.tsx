"use client";

import { CalendarEvent } from "@/types/timetable";

interface EventDetailsModalProps {
    event: CalendarEvent | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function EventDetailsModal({
    event,
    isOpen,
    onClose,
}: EventDetailsModalProps) {
    if (!isOpen || !event) return null;

    // Format time to "10:30 AM" format
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    };

    const startTime = formatTime(event.start);
    const endTime = formatTime(event.end);
    const isFinished = event.resource?.status === "FINISHED";

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content max-w-md"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 pr-4">
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">
                            {event.resource?.courseCode}
                        </h2>
                        <p className="text-sm text-[var(--text-secondary)] mt-1">
                            {event.resource?.courseTitle}
                        </p>
                    </div>
                    <button onClick={onClose} className="btn-icon flex-shrink-0">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18 18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="space-y-4 mb-6">
                    {/* Time */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--calendar-header-bg)] flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-4 h-4 text-[var(--text-secondary)]"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                                Time
                            </p>
                            <p className="text-sm font-medium">
                                {startTime} - {endTime}
                            </p>
                        </div>
                    </div>

                    {/* Location */}
                    {event.resource?.location && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--calendar-header-bg)] flex items-center justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-4 h-4 text-[var(--text-secondary)]"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                                    />
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                                    Location
                                </p>
                                <p className="text-sm font-medium">
                                    {event.resource.location}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Lecturer */}
                    {event.resource?.lecturer && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--calendar-header-bg)] flex items-center justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-4 h-4 text-[var(--text-secondary)]"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                                    Lecturer
                                </p>
                                <p className="text-sm font-medium">
                                    {event.resource.lecturer}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Lesson Type */}
                    {event.resource?.lessonType && (
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--calendar-header-bg)] flex items-center justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-4 h-4 text-[var(--text-secondary)]"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5"
                                    />
                                </svg>
                            </div>
                            <div>
                                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                                    Type
                                </p>
                                <p className="text-sm font-medium">
                                    {event.resource.lessonType}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Status Badge */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--calendar-header-bg)] flex items-center justify-center">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-4 h-4 text-[var(--text-secondary)]"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                                />
                            </svg>
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                                Status
                            </p>
                            <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isFinished
                                        ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    }`}
                            >
                                {isFinished ? "Finished" : "Upcoming"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end">
                    <button onClick={onClose} className="btn-secondary">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
