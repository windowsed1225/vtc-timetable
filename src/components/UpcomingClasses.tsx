"use client";

import type { CalendarEvent } from "@/types/timetable";
import { formatCompactClassDate } from "@/lib/event-date";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

interface UpcomingClassesProps {
	events: CalendarEvent[];
	onSelect: (event: CalendarEvent) => void;
}

export default function UpcomingClasses({ events, onSelect }: UpcomingClassesProps) {
	const locale = useLocale();
	const t = useTranslations("calendar");
	const [now] = useState(() => Date.now());
	const upcoming = useMemo(() => events
		.filter((event) => event.start.getTime() > now)
		.filter((event) => event.resource?.status !== "CANCELED" && event.resource?.eventType !== "deadline")
		.sort((a, b) => a.start.getTime() - b.start.getTime())
		.slice(0, 3), [events, now]);

	const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong" }), [locale]);

	if (upcoming.length === 0) {
		return (
			<section className="upcoming-classes is-empty" aria-labelledby="upcoming-classes-title">
				<span><strong id="upcoming-classes-title">{t("upcomingClasses")}</strong><span aria-hidden="true"> · </span>{t("upcomingCompactEmpty")}</span>
				<small>{t("upcomingClear")}</small>
			</section>
		);
	}

	return (
		<section className="upcoming-classes" aria-labelledby="upcoming-classes-title">
			<div className="upcoming-classes-heading">
				<h2 id="upcoming-classes-title">{t("upcomingClasses")}</h2>
				<span>{t("nextClasses", { count: upcoming.length })}</span>
			</div>
			<div className="upcoming-classes-list">
				{upcoming.map((event) => {
					const compactDate = formatCompactClassDate(event.start, locale);
					const meta = [compactDate, event.resource?.location].filter(Boolean).join(" · ");
					return (
					<button
						type="button"
						key={`${event.resource?.courseCode ?? event.title}-${event.start.toISOString()}-${event.end.toISOString()}`}
						className="upcoming-class-chip"
						onClick={() => onSelect(event)}
						aria-label={`${event.resource?.courseCode || event.title}, ${compactDate ?? ""}, ${timeFormatter.format(event.start)}`}
					>
						<time dateTime={event.start.toISOString()}>{timeFormatter.format(event.start)}</time>
						<strong>{event.resource?.courseCode || event.title}</strong>
						{meta ? <span>{meta}</span> : null}
					</button>
					);
				})}
			</div>
		</section>
	);
}
