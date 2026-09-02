"use client";

import { LINE_COLORS } from "@/lib/colors";
import { useNow } from "@/lib/use-now";
import { isSameDay, isoWeekNumber, weekdaysOf } from "@/lib/week";
import type { CalendarEvent } from "@/types/timetable";
import { Ban, Check, Clock, MapPin, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, type CSSProperties } from "react";

type SessionState = "attended" | "absent" | "upcoming" | "cancelled";

const STATE_ICON = { attended: Check, absent: X, upcoming: Clock, cancelled: Ban } as const;

const STATE_CLASS: Record<SessionState, string> = {
	attended: "bg-success/15 text-success",
	absent: "bg-error/15 text-error",
	upcoming: "bg-secondary text-secondary-foreground",
	cancelled: "bg-muted text-muted-foreground",
};

function sessionState(event: CalendarEvent, now: Date): SessionState {
	const status = event.resource?.status;
	if (status === "CANCELED") return "cancelled";
	if (status === "ABSENT") return "absent";
	if (status === "FINISHED" || event.end < now) return "attended";
	return "upcoming";
}

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

	const dayLabel = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long" }), [locale]);
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
		<section className="campus-week rounded-4xl border border-border bg-card p-5 sm:p-6" aria-label={t("regionLabel")}>
			<div className="mb-5 flex items-center justify-between gap-4">
				<div className="min-w-0">
					<h2 className="text-lg font-black text-card-foreground">
						{isCurrentWeek ? t("thisWeek") : t("weekOf", { range: rangeLabel })}
					</h2>
					<p className="text-sm text-text-tertiary">{t("subtitle", { range: rangeLabel })}</p>
				</div>
				<span className="shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground">
					{t("weekBadge", { week: weekNumber })}
				</span>
			</div>

			{error ? (
				<p className="rounded-3xl border border-error/30 bg-error/10 px-4 py-6 text-center text-sm text-error">
					{error}
				</p>
			) : isLoading ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
					{days.map((day) => (
						<div key={day.toISOString()} className="flex flex-col gap-3">
							<div className="h-10 animate-pulse rounded-2xl bg-muted" />
							<div className="h-28 animate-pulse rounded-3xl bg-muted/60" />
						</div>
					))}
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
					{columns.map((column) => (
						<div key={column.day.toISOString()} className="flex flex-col gap-3">
							<div
								className={`flex items-center justify-between gap-1.5 rounded-2xl px-3 py-2 ${
									column.isToday ? "bg-primary text-primary-foreground" : "bg-muted text-text-secondary"
								}`}
							>
								<span className="shrink-0 text-sm font-bold">{dayLabel.format(column.day)}</span>
								<span className={`truncate text-xs ${column.isToday ? "text-primary-foreground/80" : "text-text-tertiary"}`}>
									{dateLabel.format(column.day)}
								</span>
							</div>

							<div className="flex flex-col gap-2.5">
								{column.sessions.length === 0 ? (
									<p className="rounded-2xl bg-muted/50 px-3 py-6 text-center text-xs text-text-tertiary">
										{t("noClasses")}
									</p>
								) : (
									column.sessions.map((event) => {
										const state = sessionState(event, now);
										const Icon = STATE_ICON[state];
										const color = LINE_COLORS[event.resource?.colorIndex ?? 0] ?? LINE_COLORS[0];
										return (
											<article
												key={`${event.resource?.vtc_id ?? event.title}-${event.start.getTime()}`}
												className={`rounded-3xl border border-border bg-background p-3 text-left transition-shadow hover:shadow-md ${
													state === "cancelled" ? "opacity-60" : ""
												}`}
											>
												<button
													type="button"
													onClick={() => onSelectEvent?.(event)}
													className="w-full text-left"
													disabled={!onSelectEvent}
												>
													<span className="flex items-center gap-2">
														<span
															aria-hidden="true"
															className="h-8 w-1.5 shrink-0 rounded-full"
															style={{ background: color } as CSSProperties}
														/>
														<span className="min-w-0">
															<span
																className={`block truncate text-xs font-bold text-foreground ${
																	state === "cancelled" ? "line-through" : ""
																}`}
															>
																{event.resource?.courseTitle || event.title}
															</span>
															<span className="block truncate font-mono text-[11px] text-text-tertiary">
																{event.resource?.courseCode}
															</span>
														</span>
													</span>

													<span className="mt-2.5 flex items-center gap-1 font-mono text-[11px] text-text-tertiary">
														<Clock className="size-3" aria-hidden="true" />
														{timeLabel.format(event.start)}–{timeLabel.format(event.end)}
													</span>

													{event.resource?.location ? (
														<span className="mt-1 flex items-center gap-1 font-mono text-[11px] text-text-tertiary">
															<MapPin className="size-3" aria-hidden="true" />
															{event.resource.location}
														</span>
													) : null}

													<span
														className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${STATE_CLASS[state]}`}
													>
														<Icon className="size-3" aria-hidden="true" />
														{t(`state.${state}`)}
													</span>
												</button>
											</article>
										);
									})
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
