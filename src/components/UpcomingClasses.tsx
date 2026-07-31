"use client";

import type { CalendarEvent } from "@/types/timetable";
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

	const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
	const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }), [locale]);

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
				{upcoming.map((event) => (
					<button
						type="button"
						key={`${event.resource?.courseCode ?? event.title}-${event.start.toISOString()}-${event.end.toISOString()}`}
						className="upcoming-class-chip"
						onClick={() => onSelect(event)}
						aria-label={`${event.resource?.courseCode || event.title}, ${dateFormatter.format(event.start)}, ${timeFormatter.format(event.start)}`}
					>
						<time dateTime={event.start.toISOString()}>{timeFormatter.format(event.start)}</time>
						<strong>{event.resource?.courseCode || event.title}</strong>
						{event.resource?.location && <span>{event.resource.location}</span>}
					</button>
				))}
			</div>
		</section>
	);
}
