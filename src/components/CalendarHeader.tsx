"use client";

import dayjs from "dayjs";
import "dayjs/locale/zh-hk";
import { getCalendarDateStrip } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { Views } from "react-big-calendar";

type ViewType = (typeof Views)[keyof typeof Views];

interface CalendarHeaderProps {
    date: Date;
    view: ViewType;
    semesterFilter: string;
    onSemesterFilterChange: (semester: string) => void;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
    onDateSelect: (date: Date) => void;
    onViewChange: (view: ViewType) => void;
}

export default function CalendarHeader({
    date,
    view,
    semesterFilter,
    onSemesterFilterChange,
    onNavigate,
    onDateSelect,
    onViewChange,
}: CalendarHeaderProps) {
    const t = useTranslations("calendar");
    const locale = useLocale();
    const dayjsLocale = locale === "zh-HK" ? "zh-hk" : "en";
    const formattedDate = dayjs(date).locale(dayjsLocale).format(
        view === Views.DAY ? "MMMM D, YYYY" : "MMMM YYYY"
    );

    const viewOptions: { key: ViewType; label: string }[] = [
        { key: "month", label: t("month") },
        { key: "work_week", label: t("week") },
        { key: "day", label: t("day") },
        { key: "agenda", label: t("agenda") },
    ];
    const mobileDates = getCalendarDateStrip(date);

    return (
		<div className="calendar-header-shell">
		<header className="calendar-header">
            {/* Left: Navigation */}
			<div className="calendar-navigation flex items-center gap-1">
                <button
                    onClick={() => onNavigate("PREV")}
                    className="btn-icon"
                    aria-label={t("previous")}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                </button>
                <button
                    onClick={() => onNavigate("NEXT")}
                    className="btn-icon"
                    aria-label={t("next")}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                </button>
                <button
                    onClick={() => onNavigate("TODAY")}
					className="btn-secondary ml-2 text-sm"
                >
                    {t("today")}
                </button>
            </div>

            {/* Center: Date — animates on change */}
            <h2
                key={formattedDate}
				className="calendar-title font-display animate-fadeIn"
            >
                {formattedDate}
            </h2>

            {/* Right: View Switcher */}
			<div className="calendar-header-tools">
				<label className="sr-only" htmlFor="calendar-semester-filter">{t("semester")}</label>
				<select
					id="calendar-semester-filter"
					value={semesterFilter}
					onChange={(event) => onSemesterFilterChange(event.target.value)}
					className="semester-select"
				>
					<option value="all">{t("allSemesters")}</option>
					<option value="SEM 1">{t("fall")}</option>
					<option value="SEM 2">{t("spring")}</option>
					<option value="SEM 3">{t("summer")}</option>
				</select>
			<div className="view-switcher" role="group" aria-label={t("calendarView")}>
                {viewOptions.map((v) => (
                    <button
                        key={v.key}
                        onClick={() => onViewChange(v.key)}
						className={`view-switcher-button ${view === v.key
							? "is-active"
							: "text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-overlay"
							}`}
						aria-pressed={view === v.key}
                    >
                        {v.label}
                    </button>
                ))}
            </div>
			</div>
        </header>
		<div className="calendar-mobile-dates" role="group" aria-label={t("selectCalendarDate")}>
			{mobileDates.map((candidate) => {
				const localizedDate = dayjs(candidate).locale(dayjsLocale);
				const isActive = localizedDate.isSame(date, "day");
				return (
					<button
						type="button"
						key={candidate.toISOString()}
						className={isActive ? "is-active" : ""}
						onClick={() => onDateSelect(candidate)}
						aria-pressed={isActive}
						aria-label={localizedDate.format("dddd, MMMM D")}
					>
						<span>{localizedDate.format("ddd")}</span>
						<strong>{localizedDate.format("D")}</strong>
					</button>
				);
			})}
		</div>
		</div>
    );
}
