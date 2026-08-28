"use client";

import { useState } from "react";
import { exportSemesterIcs } from "@/app/actions";

// Semester display names for the button and filename
const SEMESTER_DISPLAY: Record<string, { label: string; filename: string }> = {
    "SEM 1": { label: "Semester 1", filename: "VTC_Schedule_SEM1" },
    "SEM 2": { label: "Semester 2", filename: "VTC_Schedule_SEM2" },
    "SEM 3": { label: "Semester 3", filename: "VTC_Schedule_SEM3" },
    "SEM 4": { label: "Semester 4", filename: "VTC_Schedule_SEM4" },
    "SEM 5": { label: "Semester 5", filename: "VTC_Schedule_SEM5" },
    "SEM 6": { label: "Semester 6", filename: "VTC_Schedule_SEM6" },
    "SEM 7": { label: "Semester 7", filename: "VTC_Schedule_SEM7" },
    "SEM 8": { label: "Semester 8", filename: "VTC_Schedule_SEM8" },
    "SEM 9": { label: "Semester 9", filename: "VTC_Schedule_SEM9" },
};

interface ExportSemesterButtonProps {
    semester: string;
    variant?: "primary" | "secondary";
}

export default function ExportSemesterButton({
    semester,
    variant = "secondary",
}: ExportSemesterButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);

        try {
            const result = await exportSemesterIcs(semester);

            if (!result.success || !result.data) {
                alert(result.error || "Failed to export calendar");
                return;
            }

            // Create and trigger download
            const blob = new Blob([result.data], {
                type: "text/calendar;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `${SEMESTER_DISPLAY[semester]?.filename || "VTC_Schedule"}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Export error:", error);
            alert("Failed to export calendar");
        } finally {
            setIsExporting(false);
        }
    };

    const displayInfo = SEMESTER_DISPLAY[semester];
    const buttonClass = variant === "primary" ? "btn-primary" : "btn-secondary";

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className={`${buttonClass} flex items-center gap-2 text-sm disabled:opacity-50 active:scale-95 transition-transform ${isExporting ? "btn-syncing" : ""}`}
        >
            {isExporting ? (
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
                    Exporting...
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
                            d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                        />
                    </svg>
                    Export {displayInfo?.label || semester}
                </>
            )}
        </button>
    );
}
