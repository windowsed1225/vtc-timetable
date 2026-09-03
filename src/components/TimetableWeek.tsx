"use client";

import { useNow } from "@/lib/use-now";
import { isSameDay, isoWeekNumber, weekdaysOf } from "@/lib/week";
import TimetableSessionCard from "./TimetableSessionCard";
import type { CalendarEvent } from "@/types/timetable";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

interface TimetableWeekProps {
	events: CalendarEvent[];
	/** Any date inside the week to render. Follows the calendar below it. */
	date: Date;
	onSelectEvent?: (event: CalendarEvent) => void;
	/** True while the first load is still resolving. */
	isLoading?: boolean;
	/** Set when loading the week failed, so the grid can say so instead of showing nothing. */
	error?: string | null;
}

/**
 * Monday-to-Friday strip of the week containing `date`, built from the signed-in
 * user's synced classes. Deadlines live in the calendar below and are excluded
 * here so each column stays a list of taught classes.
 */
export default function TimetableWeek({ events, date, onSelectEvent, isLoading, error }: TimetableWeekProps) {
	const t = useTranslations("week");
	const locale = useLocale();
	const now = useNow();

	const days = useMemo(() => weekdaysOf(date), [date]);

	const dayLabel = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
	const dateLabel = useMemo(() => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }), [locale]);
	const timeLabel = useMemo(
		() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }),
		[locale],
	);

	const columns = useMemo(() => {
		const classes = events.filter((event) => event.resource?.eventType !== "deadline");
		return days.map((day) => ({
			day,
			isToday: isSameDay(day, now),
			sessions: classes
				.filter((event) => isSameDay(event.start, day))
				.sort((a, b) => a.start.getTime() - b.start.getTime()),
		}));
	}, [days, events, now]);

	const rangeLabel = `${dateLabel.format(days[0])} – ${dateLabel.format(days[4])}`;
	const weekNumber = isoWeekNumber(days[0]);
	const isCurrentWeek = columns.some((column) => column.isToday);

	return (
		<section className="campus-week rounded-4xl border border-border bg-card p-5" aria-label={t("regionLabel")}>
			<div className="mb-4 flex items-center justify-between gap-4">
				<div className="min-w-0">
					<h2 className="text-lg font-black text-card-foreground">{t("weeklyTitle")}</h2>
					<p className="mt-0.5 truncate text-xs text-muted-foreground">
						{isCurrentWeek ? t("thisWeek") : t("weekOf", { range: rangeLabel })} · {t("subtitle", { range: rangeLabel })}
					</p>
				</div>
				<span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
					{t("weekBadge", { week: weekNumber })}
				</span>
			</div>

			{error ? (
				<p className="rounded-2xl border border-error/30 bg-error/10 px-4 py-6 text-center text-xs text-error">
					{error}
				</p>
			) : isLoading ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-hidden="true">
					{days.map((day) => (
						<div key={day.toISOString()} className="rounded-2xl bg-muted/50 p-3">
							<div className="mb-3 h-3 w-20 animate-pulse rounded-full bg-muted" />
							<div className="h-16 animate-pulse rounded-xl bg-muted" />
						</div>
					))}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
					{columns.map((column) => (
						<div
							key={column.day.toISOString()}
							className={`min-w-0 rounded-2xl p-3 ${
								column.isToday ? "bg-primary/10 ring-1 ring-primary/45" : "bg-muted/50"
							}`}
							aria-current={column.isToday ? "date" : undefined}
						>
							<p
								className={`mb-3 text-center text-xs font-bold ${
									column.isToday ? "text-primary" : "text-muted-foreground"
								}`}
							>
								{dayLabel.format(column.day)} · {dateLabel.format(column.day)}
							</p>

							<div className="flex flex-col gap-2">
								{column.sessions.length === 0 ? (
									<p className="py-4 text-center text-[10px] text-muted-foreground">{t("noClasses")}</p>
								) : (
									column.sessions.map((event) => (
										<TimetableSessionCard
											key={`${event.resource?.vtc_id ?? event.title}-${event.start.getTime()}`}
											event={event}
											now={now}
											timeLabel={timeLabel}
											onSelect={onSelectEvent}
										/>
									))
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
