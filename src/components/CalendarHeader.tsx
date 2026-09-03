"use client";

import dayjs from "dayjs";
import "dayjs/locale/zh-hk";
import { getCalendarDateStrip } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Views } from "react-big-calendar";

type ViewType = (typeof Views)[keyof typeof Views];

interface CalendarHeaderProps {
    date: Date;
    view: ViewType;
    onNavigate: (action: "PREV" | "NEXT" | "TODAY") => void;
    onDateSelect: (date: Date) => void;
    onViewChange: (view: ViewType) => void;
}

/**
 * Period toolbar above the calendar: view pills on the left, the range label
 * between the step arrows on the right. The semester filter moved up into the
 * "My calendar" card, which is where the reference layout carries it.
 */
export default function CalendarHeader({
    date,
    view,
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
        { key: "day", label: t("day") },
        { key: "work_week", label: t("week") },
        { key: "month", label: t("month") },
        { key: "agenda", label: t("agenda") },
    ];
    const mobileDates = getCalendarDateStrip(date);

    return (
        <div className="calendar-header-shell">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-3">
                <div className="flex gap-1 rounded-2xl bg-muted p-1" role="group" aria-label={t("calendarView")}>
                    {viewOptions.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            onClick={() => onViewChange(option.key)}
                            aria-pressed={view === option.key}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                                view === option.key
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onNavigate("PREV")}
                        className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted"
                        aria-label={t("previous")}
                    >
                        <ChevronLeft className="size-4" aria-hidden="true" />
                    </button>
                    <span key={formattedDate} className="animate-fadeIn text-sm font-bold text-card-foreground">
                        {formattedDate}
                    </span>
                    <button
                        type="button"
                        onClick={() => onNavigate("NEXT")}
                        className="rounded-xl border border-border p-2 text-muted-foreground transition hover:bg-muted"
                        aria-label={t("next")}
                    >
                        <ChevronRight className="size-4" aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={() => onNavigate("TODAY")}
                        className="rounded-xl bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground transition hover:bg-accent"
                    >
                        {t("today")}
                    </button>
                </div>
            </div>

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
