"use client";

import type { CalendarEventDensity } from "@/lib/utils";
import type { CalendarEvent } from "@/types/timetable";
import dayjs from "dayjs";

interface CalendarEventCardProps {
	event: CalendarEvent;
	density: CalendarEventDensity;
}

export default function CalendarEventCard({ event, density }: CalendarEventCardProps) {
	const courseCode = event.resource?.courseCode || event.title;
	const courseTitle = event.resource?.courseTitle || event.title;
	const time = `${dayjs(event.start).format("HH:mm")}–${dayjs(event.end).format("HH:mm")}`;
	const isCancelled = event.resource?.status === "CANCELED";

	return (
		<div className={`calendar-event-card density-${density}`}>
			<div className="calendar-event-primary">
				<strong className={isCancelled ? "is-cancelled" : ""}>{courseCode}</strong>
				<time dateTime={event.start.toISOString()}>{time}</time>
			</div>
			{density !== "compact" && <span className="calendar-event-title">{courseTitle}</span>}
			{density === "full" && event.resource?.location && (
				<span className="calendar-event-room">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
						<path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
					</svg>
					{event.resource.location}
				</span>
			)}
			{event.resource?.isAdjusted && <span className="calendar-event-adjusted" title="Manually adjusted" aria-label="Manually adjusted">↯</span>}
		</div>
	);
}
