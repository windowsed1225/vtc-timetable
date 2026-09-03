"use client";

import { isSameDay } from "@/lib/week";
import { useNow } from "@/lib/use-now";
import type { CalendarEvent } from "@/types/timetable";
import { Flag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import TimetableSessionCard from "./TimetableSessionCard";

interface TimetableAgendaProps {
	events: CalendarEvent[];
	/** Any date inside the month to list. */
	date: Date;
	onSelectEvent?: (event: CalendarEvent) => void;
	/** True while the first load is still resolving. */
	isLoading?: boolean;
	/** Set when loading failed, so the list says so instead of reading as empty. */
	error?: string | null;
}

/**
 * Chronological list of everything scheduled in the month of `date`, grouped by
 * day. Unlike the month grid this keeps deadlines, so the agenda stays the one
 * view that shows classes and coursework side by side.
 */
export default function TimetableAgenda({ events, date, onSelectEvent, isLoading, error }: TimetableAgendaProps) {
	const t = useTranslations("calendar");
	const locale = useLocale();
	const now = useNow();

	const monthLabel = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
	const dayLabel = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" }), [locale]);
	const timeLabel = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }), [locale]);

	const days = useMemo(() => {
		const inMonth = events
			.filter((event) => event.start.getMonth() === date.getMonth() && event.start.getFullYear() === date.getFullYear())
			.toSorted((a, b) => a.start.getTime() - b.start.getTime());

		const grouped: Array<{ day: Date; items: CalendarEvent[] }> = [];
		for (const event of inMonth) {
			const last = grouped[grouped.length - 1];
			if (last && isSameDay(last.day, event.start)) last.items.push(event);
			else grouped.push({ day: event.start, items: [event] });
		}
		return grouped;
	}, [events, date]);

	const total = days.reduce((sum, group) => sum + group.items.length, 0);

	return (
		<section className="campus-agenda overflow-hidden rounded-4xl border border-border bg-card" aria-label={t("agenda")}>
			<div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
				<div className="min-w-0">
					<h2 className="text-lg font-black text-card-foreground">{monthLabel.format(date)}</h2>
					<p className="mt-0.5 text-xs text-muted-foreground">{t("agendaSubtitle")}</p>
				</div>
				<span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
					{t("monthClasses", { count: total })}
				</span>
			</div>

			{error ? (
				<p className="px-5 py-10 text-center text-xs text-error">{error}</p>
			) : isLoading ? (
				<div className="flex flex-col gap-3 p-5" aria-hidden="true">
					{[0, 1, 2].map((key) => (
						<div key={key} className="h-20 animate-pulse rounded-2xl bg-muted" />
					))}
				</div>
			) : days.length === 0 ? (
				<p className="px-5 py-12 text-center text-sm text-muted-foreground">{t("noScheduleYet")}</p>
			) : (
				<div className="flex flex-col divide-y divide-border">
					{days.map((group) => (
						<div key={group.day.toDateString()} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:gap-5">
							<p
								className={`shrink-0 text-xs font-bold sm:w-40 ${
									isSameDay(group.day, now) ? "text-primary" : "text-muted-foreground"
								}`}
							>
								{dayLabel.format(group.day)}
							</p>
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								{group.items.map((event) =>
									event.resource?.eventType === "deadline" ? (
										<div
											key={`${event.resource?.vtc_id ?? event.title}-${event.start.getTime()}`}
											className="flex items-center gap-2 rounded-xl border border-border bg-secondary/70 p-2 text-[11px] font-bold text-card-foreground"
										>
											<Flag className="size-3 shrink-0 text-primary" aria-hidden="true" />
											<span className="truncate">{event.title}</span>
											<span className="ml-auto shrink-0 font-mono text-[10px] font-medium text-muted-foreground">
												{event.resource.courseCode}
											</span>
										</div>
									) : (
										<TimetableSessionCard
											key={`${event.resource?.vtc_id ?? event.title}-${event.start.getTime()}`}
											event={event}
											now={now}
											timeLabel={timeLabel}
											onSelect={onSelectEvent}
										/>
									),
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
