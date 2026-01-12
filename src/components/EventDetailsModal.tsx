"use client";

import { CalendarEvent } from "@/types/timetable";
import { useState } from "react";
import { updateEventDetails, setEventStatus, finishCourseEarly } from "@/app/actions";

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
    const [isEditing, setIsEditing] = useState(false);
    const [editStartTime, setEditStartTime] = useState("");
    const [editEndTime, setEditEndTime] = useState("");
    const [isLoading, setIsLoading] = useState(false);

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

    // Compute effective status based on current time
    const storedStatus = event.resource?.status || "UPCOMING";
    const now = new Date();
    const status = storedStatus === "UPCOMING" && event.end < now ? "FINISHED" : storedStatus;

    const handleEditTime = async () => {
        if (!editStartTime || !editEndTime) return;
        setIsLoading(true);

        const newStart = new Date(event.start);
        const [sh, sm] = editStartTime.split(":").map(Number);
        newStart.setHours(sh, sm);

        const newEnd = new Date(event.end);
        const [eh, em] = editEndTime.split(":").map(Number);
        newEnd.setHours(eh, em);

        const vtc_id = (event.resource as any).vtc_id;
        if (!vtc_id) {
            alert("Unexpected error: missing event ID");
            setIsLoading(false);
            return;
        }

        const result = await updateEventDetails(vtc_id, newStart, newEnd);
        // Actually Event model has vtc_id. vtc_id is not exposed in CalendarEvent yet?
        // Wait, vtc_id is unique. Let's send it.
        // I need to add vtc_id to CalendarEvent resource in actions.ts

        setIsLoading(false);
        setIsEditing(false);
        onClose();
    };

    const handleCancelClass = async () => {
        setIsLoading(true);
        // I'll need the vtc_id here. Let's assume I added it to resource.
        const vtc_id = (event.resource as any).vtc_id;
        if (vtc_id) {
            await setEventStatus(vtc_id, "CANCELED");
        }
        setIsLoading(false);
        onClose();
    };

    const handleFinishEarly = async () => {
        if (!confirm("Are you sure you want to finish this course early? All future classes will be marked as FINISHED.")) return;
        setIsLoading(true);
        await finishCourseEarly(event.resource?.courseCode!, event.resource?.semester!);
        setIsLoading(false);
        onClose();
    };

    const startInputVal = `${event.start.getHours().toString().padStart(2, '0')}:${event.start.getMinutes().toString().padStart(2, '0')}`;
    const endInputVal = `${event.end.getHours().toString().padStart(2, '0')}:${event.end.getMinutes().toString().padStart(2, '0')}`;

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
                            {isEditing ? (
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="time"
                                        defaultValue={startInputVal}
                                        onChange={(e) => setEditStartTime(e.target.value)}
                                        className="px-2 py-1 bg-[var(--background)] border border-[var(--calendar-border)] rounded-md text-sm"
                                    />
                                    <span>-</span>
                                    <input
                                        type="time"
                                        defaultValue={endInputVal}
                                        onChange={(e) => setEditEndTime(e.target.value)}
                                        className="px-2 py-1 bg-[var(--background)] border border-[var(--calendar-border)] rounded-md text-sm"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm font-medium">
                                    {startTime} - {endTime}
                                </p>
                            )}
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
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status === "FINISHED"
                                    ? "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                                    : status === "CANCELED"
                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                        : status === "RESCHEDULED"
                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                    }`}
                            >
                                {status.charAt(0) + status.slice(1).toLowerCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={handleEditTime} disabled={isLoading} className="btn-primary flex-1">
                                    Save
                                </button>
                                <button onClick={() => setIsEditing(false)} className="btn-secondary flex-1">
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        setEditStartTime(startInputVal);
                                        setEditEndTime(endInputVal);
                                        setIsEditing(true);
                                    }}
                                    className="btn-secondary flex-1 text-sm py-2"
                                >
                                    Edit Time
                                </button>
                                <button
                                    onClick={handleCancelClass}
                                    disabled={isLoading || status === "CANCELED"}
                                    className={`flex-1 text-sm py-2 rounded-xl font-medium border transition-colors ${status === "CANCELED" ? 'bg-red-50 text-red-500 border-red-200' : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                                >
                                    {status === "CANCELED" ? "Canceled" : "Class Canceled"}
                                </button>
                            </>
                        )}
                    </div>

                    {!isEditing && (
                        <div className="pt-3 border-t border-[var(--sidebar-border)]">
                            <button
                                onClick={handleFinishEarly}
                                disabled={isLoading}
                                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                                </svg>
                                Finish Course Early
                            </button>
                            <p className="text-[10px] text-[var(--text-tertiary)] text-center mt-2 px-4 leading-tight">
                                This will mark ALL future sessions of this course as finished and remove them from attendance prediction.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
