"use client";

import { CalendarEvent } from "@/types/timetable";
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
	const upcoming = useMemo(() => {
		return events
			.filter((event) => event.start.getTime() > now)
			.filter((event) => event.resource?.status !== "CANCELED" && event.resource?.eventType !== "deadline")
			.sort((a, b) => a.start.getTime() - b.start.getTime())
			.slice(0, 3);
	}, [events, now]);

	const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
	const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }), [locale]);

	return (
		<section className="upcoming-classes" aria-labelledby="upcoming-classes-title">
			<div className="upcoming-classes-heading">
				<h2 id="upcoming-classes-title">{t("upcomingClasses")}</h2>
				<span>{t("nextClasses", { count: upcoming.length })}</span>
			</div>
			<div className="upcoming-classes-list">
				{upcoming.length === 0 ? <p className="upcoming-classes-empty">{t("noUpcomingClasses")}</p> : upcoming.map((event) => {
					const durationMinutes = Math.max(0, Math.round((event.end.getTime() - event.start.getTime()) / 60000));
					return (
						<button type="button" key={`${event.resource?.courseCode ?? event.title}-${event.start.toISOString()}`} className="upcoming-class-card" onClick={() => onSelect(event)}>
							<span className="upcoming-class-time">{timeFormatter.format(event.start)}</span>
							<span className="upcoming-class-content">
								<strong>{event.resource?.courseCode || event.title}</strong>
								<small>{event.resource?.courseTitle || event.title}</small>
								<small>{dateFormatter.format(event.start)} · {durationMinutes} min</small>
							</span>
							{event.resource?.location && <span className="upcoming-class-room">{event.resource.location}</span>}
						</button>
					);
				})}
			</div>
		</section>
	);
}
