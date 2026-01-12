"use client";

import { useState, useMemo } from "react";
import { HybridAttendanceStats } from "@/app/actions";

interface SkippingCalculatorProps {
    course: HybridAttendanceStats;
}

export default function SkippingCalculator({ course }: SkippingCalculatorProps) {
    const [skipsInput, setSkipsInput] = useState<string>("0");
    const skips = parseInt(skipsInput) || 0;

    // Calculate projected rate based on calendar data
    const projectedRate = useMemo(() => {
        if (course.calendarTotalClasses === 0) return 0;
        const potentialAttendance = course.attended + Math.max(0, course.calendarRemainingClasses - skips);
        return (potentialAttendance / course.calendarTotalClasses) * 100;
    }, [course, skips]);

    const isSafe = projectedRate >= 80;
    const futureClasses = course.calendarRemainingClasses;

    // Slider max: at least 5 for usability
    const sliderMax = Math.max(futureClasses, 5);

    const handleSkipsChange = (val: string) => {
        if (val === "") {
            setSkipsInput("");
            return;
        }
        const num = parseInt(val);
        if (isNaN(num)) return;
        // Don't hard-lock the input during typing, allow up to 99 for flexibility
        setSkipsInput(Math.min(99, Math.max(0, num)).toString());
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-lg">🧮</span> Skipping Calculator
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${course.currentAttendanceRate < 80 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    Current: {course.currentAttendanceRate.toFixed(1)}%
                </span>
            </div>

            <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-[var(--text-secondary)]">
                        How many more classes will you skip? (Upcoming: {futureClasses})
                    </label>
                    <div
                        className="flex items-center gap-3"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <input
                            type="range"
                            min="0"
                            max={sliderMax}
                            value={skips || 0}
                            onChange={(e) => handleSkipsChange(e.target.value)}
                            className="flex-1 accent-[var(--calendar-today)] cursor-pointer"
                        />
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={skipsInput}
                            onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                handleSkipsChange(val);
                            }}
                            className="w-16 px-2 py-1 bg-[var(--background)] border border-[var(--calendar-border)] rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--calendar-today)]"
                        />
                    </div>
                </div>

                <div className={`p-4 rounded-xl border transition-all duration-300 ${isSafe ? 'bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800' : 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Projected Final Rate</span>
                        <span className={`text-xl font-bold ${isSafe ? 'text-green-600' : 'text-red-600'}`}>
                            {projectedRate.toFixed(1)}%
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {isSafe ? (
                            <>
                                <span className="text-xl">✅</span>
                                <p className="text-sm text-green-700 dark:text-green-400">
                                    Safe to skip! You'll stay above 80%.
                                </p>
                            </>
                        ) : (
                            <>
                                <span className="text-xl">⚠️</span>
                                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                                    DANGER! Your rate will drop below the 80% threshold.
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--calendar-border)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Safe to Skip</p>
                        <p className="text-xs font-bold">{course.safeToSkipCount} classes</p>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--calendar-border)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Attended Hours</p>
                        <p className="text-xs font-bold">{Math.round((course.calendarConductedHours * course.attended / Math.max(1, course.calendarConductedClasses)) * 10) / 10} hrs</p>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--calendar-border)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Required (80%)</p>
                        <p className="text-xs font-bold">{Math.round(course.calendarTotalHours * 0.8 * 10) / 10} hrs</p>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--calendar-border)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Max Skip</p>
                        <p className="text-xs font-bold">{Math.floor(course.calendarTotalClasses * 0.2)} classes</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
