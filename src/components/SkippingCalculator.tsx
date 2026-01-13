"use client";

import { useState, useMemo } from "react";
import { HybridAttendanceStats } from "@/app/actions";

interface SkippingCalculatorProps {
    course: HybridAttendanceStats;
}

export default function SkippingCalculator({ course }: SkippingCalculatorProps) {
    const [skipClassesInput, setSkipClassesInput] = useState<string>("0");
    const skipClasses = parseInt(skipClassesInput) || 0;

    // Get class count values from course
    const attendedCount = course.attended || 0;
    const totalClasses = course.calendarTotalClasses || 0;
    const remainingClasses = course.calendarRemainingClasses || 0;
    const currentRate = course.minutesAttendanceRate ?? course.currentAttendanceRate ?? 0;

    // Calculate projected rate based on class count
    const projectedRate = useMemo(() => {
        if (totalClasses === 0) return 0;
        // If skipping X classes from remaining, calculate new attended count
        const projectedAttended = attendedCount + Math.max(0, remainingClasses - skipClasses);
        return (projectedAttended / totalClasses) * 100;
    }, [attendedCount, totalClasses, remainingClasses, skipClasses]);

    const isSafe = projectedRate >= 80;
    const safeToSkipClasses = course.safeToSkipCount || 0;

    // Slider max: remaining classes, at least 5 for usability
    const sliderMax = Math.max(remainingClasses, 5);

    const handleSkipClassesChange = (val: string) => {
        if (val === "") {
            setSkipClassesInput("");
            return;
        }
        // Allow integer input for classes
        const num = parseInt(val);
        if (isNaN(num)) return;
        setSkipClassesInput(Math.min(sliderMax, Math.max(0, num)).toString());
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                    <span className="text-lg">🧮</span> Skipping Calculator
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${currentRate < 80 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                    Current: {currentRate.toFixed(1)}%
                </span>
            </div>

            <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm text-[var(--text-secondary)]">
                        How many classes will you skip? (Remaining: {remainingClasses} classes)
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
                            step="1"
                            value={parseInt(skipClassesInput) || 0}
                            onChange={(e) => handleSkipClassesChange(e.target.value)}
                            className="flex-1 accent-[var(--calendar-today)] cursor-pointer"
                        />
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={skipClassesInput}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '');
                                    handleSkipClassesChange(val);
                                }}
                                className="w-14 px-2 py-1 bg-[var(--background)] border border-[var(--calendar-border)] rounded-md text-center text-sm focus:outline-none focus:ring-2 focus:ring-[var(--calendar-today)]"
                            />
                            <span className="text-xs text-[var(--text-tertiary)]">classes</span>
                        </div>
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
                        <p className="text-xs font-bold">{safeToSkipClasses} classes</p>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--calendar-border)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Attended Classes</p>
                        <p className="text-xs font-bold">{attendedCount}</p>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--calendar-border)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Required (80%)</p>
                        <p className="text-xs font-bold">{Math.ceil(totalClasses * 0.8)} classes</p>
                    </div>
                    <div className="p-3 bg-[var(--background)] rounded-md border border-[var(--calendar-border)]">
                        <p className="text-[10px] text-[var(--text-tertiary)] mb-0.5">Max Possible</p>
                        <p className="text-xs font-bold">{(course.maxPossibleMinutesRate ?? course.maxPossibleRate ?? 100).toFixed(0)}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
