"use client";

import { CalendarEvent } from "@/types/timetable";

interface SemesterSummaryCardProps {
    events: CalendarEvent[];
    semesterLabel: string;
}

export default function SemesterSummaryCard({
    events,
    semesterLabel,
}: SemesterSummaryCardProps) {
    // Calculate unique subjects (by courseCode)
    const uniqueSubjects = new Set(
        events.map((e) => e.resource?.courseCode).filter(Boolean)
    ).size;

    // Calculate total hours from event durations
    const totalMilliseconds = events.reduce((acc, event) => {
        const duration = event.end.getTime() - event.start.getTime();
        return acc + duration;
    }, 0);
    const totalHours = (totalMilliseconds / (1000 * 60 * 60)).toFixed(1);

    if (events.length === 0) {
        return null;
    }

    return (
        <div className="mb-4 p-3 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/50">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2 uppercase tracking-wider">
                {semesterLabel}
            </p>
            <div className="flex items-center justify-between gap-4">
                {/* Total Subjects */}
                <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                        {uniqueSubjects}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                        {uniqueSubjects === 1 ? "Subject" : "Subjects"}
                    </p>
                </div>

                {/* Divider */}
                <div className="w-px h-10 bg-[var(--sidebar-border)]" />

                {/* Total Hours */}
                <div className="flex-1 text-center">
                    <p className="text-2xl font-bold text-[var(--foreground)]">
                        {totalHours}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">Hours</p>
                </div>
            </div>
        </div>
    );
}
