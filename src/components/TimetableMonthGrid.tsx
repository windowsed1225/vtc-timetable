"use client";

import { isSameDay, isWeekend } from "@/lib/week";
import { useNow } from "@/lib/use-now";
import type { CalendarEvent } from "@/types/timetable";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import TimetableSessionCard from "./TimetableSessionCard";

interface TimetableMonthGridProps {
	events: CalendarEvent[];
	/** Any date inside the month to render. */
	date: Date;
	onSelectEvent?: (event: CalendarEvent) => void;
	/** The class the details modal is open on, outlined so the source card stays findable. */
	selectedEvent?: CalendarEvent | null;
	/** True while the first load is still resolving. */
	isLoading?: boolean;
	/** Set when loading failed, so the grid says so instead of showing an empty month. */
	error?: string | null;
}

/** Every cell of the month grid, padded so the first and last weeks are whole. */
function monthCells(date: Date): Array<{ day: Date; inMonth: boolean }> {
	const first = new Date(date.getFullYear(), date.getMonth(), 1);
	const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
	const cells: Array<{ day: Date; inMonth: boolean }> = [];

	// Lead-in from the Sunday on or before the 1st.
	for (let i = first.getDay(); i > 0; i--) {
		cells.push({ day: new Date(date.getFullYear(), date.getMonth(), 1 - i), inMonth: false });
	}
	for (let d = 1; d <= last.getDate(); d++) {
		cells.push({ day: new Date(date.getFullYear(), date.getMonth(), d), inMonth: true });
	}
	// Trail out to Saturday so the final row is not ragged.
	for (let i = 1; cells.length % 7 !== 0; i++) {
		cells.push({ day: new Date(date.getFullYear(), date.getMonth(), last.getDate() + i), inMonth: false });
	}
	return cells;
}

/**
 * Month view of the signed-in user's synced classes: a Sunday-to-Saturday grid
 * whose cells hold the same compact class cards the week strip uses. Deadlines
 * are left to the calendar's other views so each cell stays a list of classes.
 */
export default function TimetableMonthGrid({ events, date, onSelectEvent, selectedEvent, isLoading, error }: TimetableMonthGridProps) {
	const t = useTranslations("calendar");
	const locale = useLocale();
	const now = useNow();

	const monthLabel = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
	const weekdayLabel = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
	const timeLabel = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }), [locale]);

	const cells = useMemo(() => monthCells(date), [date]);

	// Sunday-to-Saturday headings, taken from a known week so the labels follow
	// the active locale rather than being hard-coded English.
	// 7 Jan 2024 was a Sunday.
	const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekdayLabel.format(new Date(2024, 0, 7 + i)).toUpperCase()), [weekdayLabel]);

	const { byDay, total } = useMemo(() => {
		const classes = events.filter((event) => event.resource?.eventType !== "deadline");
		const map = new Map<string, CalendarEvent[]>();
		let count = 0;
		for (const event of classes) {
			if (event.start.getMonth() !== date.getMonth() || event.start.getFullYear() !== date.getFullYear()) continue;
			const key = event.start.toDateString();
			const bucket = map.get(key);
			if (bucket) bucket.push(event);
			else map.set(key, [event]);
			count++;
		}
		for (const bucket of map.values()) bucket.sort((a, b) => a.start.getTime() - b.start.getTime());
		return { byDay: map, total: count };
	}, [events, date]);

	return (
		<section className="campus-month overflow-hidden rounded-4xl border border-border bg-card" aria-label={t("month")}>
			<div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
				<div className="min-w-0">
					<h2 className="text-lg font-black text-card-foreground">{monthLabel.format(date)}</h2>
					<p className="mt-0.5 text-xs text-muted-foreground">{t("monthSubtitle")}</p>
				</div>
				<span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
					{t("monthClasses", { count: total })}
				</span>
			</div>

			{/* Below `sm` seven columns cannot hold a readable card, so the grid
			    scrolls sideways at a fixed minimum width instead of crushing. */}
			<div className="campus-month-scroll">
			<div className="grid grid-cols-7 border-b border-border bg-muted/40">
				{weekdays.map((day) => (
					<div key={day} className="px-2 py-3 text-center text-[10px] font-black tracking-widest text-muted-foreground">
						{day}
					</div>
				))}
			</div>

			{error ? (
				<p className="px-5 py-10 text-center text-xs text-error">{error}</p>
			) : isLoading ? (
				<div className="grid grid-cols-7" aria-hidden="true">
					{cells.map((cell) => (
						<div key={cell.day.toISOString()} className="min-h-32 border-b border-r border-border p-2 sm:min-h-40">
							<div className="mb-2 size-6 animate-pulse rounded-full bg-muted" />
							<div className="h-16 animate-pulse rounded-xl bg-muted" />
						</div>
					))}
				</div>
			) : (
				<div className="grid grid-cols-7">
					{cells.map((cell) => {
						const sessions = cell.inMonth ? (byDay.get(cell.day.toDateString()) ?? []) : [];
						const isToday = cell.inMonth && isSameDay(cell.day, now);
						return (
							<div
								key={cell.day.toISOString()}
								aria-current={isToday ? "date" : undefined}
								className={`min-h-32 border-b border-r border-border p-2 sm:min-h-40 ${
									cell.inMonth ? (isToday ? "bg-primary/5" : "") : "bg-muted/20"
								} ${isWeekend(cell.day) ? "calendar-weekend" : ""}`}
							>
								{cell.inMonth && (
									<>
										<div className="mb-2 flex items-center justify-between">
											<span
												className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
													isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
												}`}
											>
												{cell.day.getDate()}
											</span>
											{sessions.length > 0 && <span className="text-[10px] text-muted-foreground">{sessions.length}</span>}
										</div>
										<div className="flex flex-col gap-1.5">
											{sessions.map((event) => (
												<TimetableSessionCard
													key={`${event.resource?.vtc_id ?? event.title}-${event.start.getTime()}`}
													event={event}
													now={now}
													timeLabel={timeLabel}
													onSelect={onSelectEvent}
													isSelected={event === selectedEvent}
												/>
											))}
										</div>
									</>
								)}
							</div>
						);
					})}
				</div>
			)}
			</div>
		</section>
	);
}
