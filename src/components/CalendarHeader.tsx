"use client";

import dayjs from "dayjs";
import { useTranslations } from "next-intl";
import { Views } from "react-big-calendar";

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
    const t = useTranslations("calendar");
    const formattedDate = dayjs(date).format(
        view === Views.DAY ? "MMMM D, YYYY" : "MMMM YYYY"
    );

    const viewOptions: { key: ViewType; label: string }[] = [
        { key: "month", label: t("month") },
        { key: "work_week", label: t("week") },
        { key: "day", label: t("day") },
        { key: "agenda", label: t("agenda") },
    ];

    return (
        <header className="calendar-header flex items-center justify-between px-4 py-3 mb-4">
            {/* Left: Navigation */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onNavigate("PREV")}
                    className="btn-icon"
                    aria-label="Previous"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <button
                    onClick={() => onNavigate("NEXT")}
                    className="btn-icon"
                    aria-label="Next"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
                <button
                    onClick={() => onNavigate("TODAY")}
                    className="btn-secondary ml-2 text-sm active:scale-95"
                >
                    {t("today")}
                </button>
            </div>

            {/* Center: Date — animates on change */}
            <h2
                key={formattedDate}
                className="calendar-title font-display text-lg font-semibold md:absolute md:left-1/2 md:-translate-x-1/2 animate-fadeIn"
            >
                {formattedDate}
            </h2>

            {/* Right: View Switcher */}
            <div className="view-switcher flex items-center bg-[var(--calendar-header-bg)] rounded-lg p-1">
                {viewOptions.map((v) => (
                    <button
                        key={v.key}
                        onClick={() => onViewChange(v.key)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200 active:scale-95 ${view === v.key
                            ? "bg-active text-[var(--foreground)] shadow-sm scale-[1.02]"
                            : "text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-overlay"
                            }`}
                    >
                        {v.label}
                    </button>
                ))}
            </div>
        </header>
    );
}
