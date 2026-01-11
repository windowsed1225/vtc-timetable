"use client";

import { AttendanceStats } from "@/app/actions";

interface AttendanceModalProps {
    course: AttendanceStats | null;
    onClose: () => void;
}

export default function AttendanceModal({ course, onClose }: AttendanceModalProps) {
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

                {/* Stats Bar */}
                <div className="px-4 py-3 bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.02)] border-b border-[var(--sidebar-border)]">
                    <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-4">
                            <span className="text-green-600">✓ {onTime} on time</span>
                            {late > 0 && <span className="text-yellow-600">⏱ {late} late</span>}
                            {course.absent > 0 && <span className="text-red-500">✗ {course.absent} absent</span>}
                        </div>
                        <span className="text-[var(--text-tertiary)]">
                            {course.conductedClasses}/{course.totalClasses} classes
                        </span>
                    </div>
                    <div className="w-full h-2 bg-[var(--calendar-border)] rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${course.isLow ? "bg-red-500" : "bg-green-500"}`}
                            style={{ width: `${Math.min(rate, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Class List */}
                <div className="overflow-y-auto max-h-[50vh] p-2">
                    {course.classes && course.classes.length > 0 ? (
                        <div className="space-y-1">
                            {course.classes.map((cls, index) => (
                                <div
                                    key={cls.id || index}
                                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-[rgba(0,0,0,0.02)] dark:bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(0,0,0,0.04)] dark:hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                                >
                                    {/* Status Icon */}
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cls.status === "attended"
                                                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                                : cls.status === "late"
                                                    ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                    : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                            }`}
                                    >
                                        {cls.status === "attended" ? "✓" : cls.status === "late" ? "⏱" : "✗"}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium">
                                            {cls.date}
                                        </div>
                                        <div className="text-xs text-[var(--text-tertiary)]">
                                            {cls.lessonTime} • {cls.roomName}
                                        </div>
                                    </div>

                                    {/* Attend Time */}
                                    <div className="text-right flex-shrink-0">
                                        {cls.attendTime !== "-" ? (
                                            <div className="text-sm text-[var(--text-secondary)]">
                                                {cls.attendTime}
                                            </div>
                                        ) : (
                                            <div className="text-sm text-red-500">
                                                —
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
