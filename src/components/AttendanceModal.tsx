"use client";

import { useState, useEffect } from "react";
import { HybridAttendanceStats } from "@/app/actions";
import {
    saveManualAttendanceMark,
    getManualAttendanceMark
} from "@/lib/manual-attendance";

interface AttendanceModalProps {
    course: HybridAttendanceStats | null;
    onClose: () => void;
}

export default function AttendanceModal({ course, onClose }: AttendanceModalProps) {
    const [manualMarks, setManualMarks] = useState<Record<string, "attended" | "late" | "absent">>({});

    // Load manual marks on mount and when course changes
    useEffect(() => {
        if (!course) return;

        const marks: Record<string, "attended" | "late" | "absent"> = {};
        course.classes.forEach(cls => {
            if (cls.attendTime === "MANUAL") {
                const mark = getManualAttendanceMark(course.courseCode, cls.id);
                if (mark) marks[cls.id] = mark;
                else marks[cls.id] = cls.status;
            }
        });
        setManualMarks(marks);
    }, [course]);

    // Handle manual attendance mark
    const handleManualMark = (classId: string, status: "attended" | "late" | "absent") => {
        if (!course) return;

        saveManualAttendanceMark(course.courseCode, classId, status);
        setManualMarks(prev => ({ ...prev, [classId]: status }));
    };

    if (!course) return null;

    const rate = course.attendRate ?? 0;
    const attended = course.attended ?? 0;
    const late = course.late ?? 0;
    const onTime = attended - late;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-[var(--background)] rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--sidebar-border)]">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold truncate">
                            {course.courseCode}
                        </h2>
                        <p className="text-sm text-[var(--text-tertiary)] truncate">
                            {course.courseName}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                        {course.isFollowUp && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                Follow-up
                            </span>
                        )}
                        {course.isFinished && (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                Finished
                            </span>
                        )}
                        <span
                            className={`text-lg font-bold ${course.isLow ? "text-red-500" : "text-green-500"}`}
                        >
                            {rate.toFixed(1)}%
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-3 p-1 rounded-full hover:bg-[rgba(0,0,0,0.05)] dark:hover:bg-[rgba(255,255,255,0.1)] transition-colors"
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

                {/* Stats Bar - Using Calendar-based totals */}
                <div className="px-4 py-3 bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] border-b border-[var(--sidebar-border)]">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-4">
                            <span className="text-green-600">✓ {onTime} on time</span>
                            {late > 0 && <span className="text-yellow-600">⏱ {late} late</span>}
                            {course.absent > 0 && <span className="text-red-500">✗ {course.absent} absent</span>}
                        </div>
                        <span className="text-[var(--text-tertiary)]">
                            {attended}/{course.calendarConductedClasses} conducted ({course.calendarRemainingClasses} remaining)
                        </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--calendar-border)] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${course.currentAttendanceRate < 80 ? "bg-red-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(course.currentAttendanceRate, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Class List */}
                <div className="overflow-y-auto max-h-[40vh] p-2 border-b border-[var(--sidebar-border)]">
                    {course.classes && course.classes.length > 0 ? (
                        <div className="space-y-1">
                            {course.classes.map((cls, index) => (
                                <div
                                    key={cls.id || index}
                                    className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                                >
                                    {/* Status Icon */}
                                    <div
                                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${(cls.attendTime === "MANUAL" ? (manualMarks[cls.id] || cls.status) : cls.status) === "attended"
                                                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                                : (cls.attendTime === "MANUAL" ? (manualMarks[cls.id] || cls.status) : cls.status) === "late"
                                                    ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                    : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                            }`}
                                    >
                                        {(cls.attendTime === "MANUAL" ? (manualMarks[cls.id] || cls.status) : cls.status) === "attended"
                                            ? "✓"
                                            : (cls.attendTime === "MANUAL" ? (manualMarks[cls.id] || cls.status) : cls.status) === "late"
                                                ? "⏱"
                                                : "✗"}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium">
                                            {cls.date}
                                        </div>
                                        <div className="text-[10px] text-[var(--text-tertiary)]">
                                            {cls.lessonTime} • {cls.roomName}
                                        </div>
                                    </div>

                                    {/* Attend Time or Manual Buttons */}
                                    <div className="text-right flex-shrink-0">
                                        {cls.attendTime === "MANUAL" ? (
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleManualMark(cls.id, "attended");
                                                    }}
                                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${(manualMarks[cls.id] || cls.status) === "attended"
                                                        ? "bg-green-500 text-white"
                                                        : "bg-gray-100 text-gray-400 hover:bg-green-100 hover:text-green-600 dark:bg-gray-700 dark:hover:bg-green-900/30"
                                                        }`}
                                                    title="Mark as attended"
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleManualMark(cls.id, "late");
                                                    }}
                                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${(manualMarks[cls.id] || cls.status) === "late"
                                                        ? "bg-yellow-500 text-white"
                                                        : "bg-gray-100 text-gray-400 hover:bg-yellow-100 hover:text-yellow-600 dark:bg-gray-700 dark:hover:bg-yellow-900/30"
                                                        }`}
                                                    title="Mark as late"
                                                >
                                                    ⏱
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleManualMark(cls.id, "absent");
                                                    }}
                                                    className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${(manualMarks[cls.id] || cls.status) === "absent"
                                                        ? "bg-red-500 text-white"
                                                        : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600 dark:bg-gray-700 dark:hover:bg-red-900/30"
                                                        }`}
                                                    title="Mark as absent"
                                                >
                                                    ✗
                                                </button>
                                            </div>
                                        ) : cls.attendTime !== "-" ? (
                                            <div className="text-xs text-[var(--text-secondary)]">
                                                {cls.attendTime}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-red-500 font-bold">
                                                ABSENT
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-[var(--text-tertiary)]">
                            No class records available
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
