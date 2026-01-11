"use client";

import { Views } from "react-big-calendar";
import dayjs from "dayjs";

type ViewType = (typeof Views)[keyof typeof Views];

interface CalendarHeaderProps {
    date: Date;
    view: ViewType;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
    onViewChange: (view: ViewType) => void;
}

export default function CalendarHeader({
    date,
    view,
    onNavigate,
    onViewChange,
}: CalendarHeaderProps) {
    const formattedDate = dayjs(date).format(
        view === Views.DAY ? "MMMM D, YYYY" : "MMMM YYYY"
    );

    return (
        <header className="flex items-center justify-between px-4 py-3 mb-4">
            {/* Left: Navigation */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onNavigate("PREV")}
                    className="btn-icon"
                    aria-label="Previous"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 19.5 8.25 12l7.5-7.5"
                        />
                    </svg>
                </button>
                <button
                    onClick={() => onNavigate("NEXT")}
                    className="btn-icon"
                    aria-label="Next"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-5 h-5"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m8.25 4.5 7.5 7.5-7.5 7.5"
                        />
                    </svg>
                </button>
                <button
                    onClick={() => onNavigate("TODAY")}
                    className="btn-secondary ml-2 text-sm"
                >
                    Today
                </button>
            </div>

            {/* Center: Date */}
            <h2 className="text-lg font-semibold absolute left-1/2 -translate-x-1/2">
                {formattedDate}
            </h2>

            {/* Right: View Switcher */}
            <div className="flex items-center bg-[var(--calendar-header-bg)] rounded-lg p-1">
                {(["month", "week", "day", "agenda"] as ViewType[]).map((v) => (
                    <button
                        key={v}
                        onClick={() => onViewChange(v)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${view === v
                                ? "bg-white dark:bg-[var(--calendar-border)] text-[var(--foreground)] shadow-sm"
                                : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                            }`}
                    >
                        {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                ))}
            </div>
        </header>
    );
}
