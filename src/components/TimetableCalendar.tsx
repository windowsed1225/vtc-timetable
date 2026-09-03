"use client";

import { getCalendarEventDensity, isCalendarActivationKey } from "@/lib/utils";
import type { CalendarEvent } from "@/types/timetable";
import dayjs from "dayjs";
import "dayjs/locale/zh-hk";
import { useMemo, type KeyboardEvent as ReactKeyboardEvent, type SyntheticEvent } from "react";
import { useTranslations } from "next-intl";
import { Calendar, dayjsLocalizer, type View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CalendarEventCard from "./CalendarEventCard";
import TimetableAgenda from "./TimetableAgenda";
import TimetableMonthGrid from "./TimetableMonthGrid";
import TimetableWeek from "./TimetableWeek";
import UpcomingClasses from "./UpcomingClasses";

const localizer = dayjsLocalizer(dayjs);

interface TimetableCalendarProps {
	events: CalendarEvent[];
	view: View;
	date: Date;
	onViewChange: (view: View) => void;
	onNavigate: (date: Date) => void;
	onSelectEvent?: (event: CalendarEvent) => void;
	locale?: string;
}

export default function TimetableCalendar({
	events,
	view,
	date,
	onViewChange,
	onNavigate,
	onSelectEvent,
	locale = "en",
}: TimetableCalendarProps) {
	const tEvent = useTranslations("event");
	const dayjsLocale = locale === "zh-HK" ? "zh-hk" : "en";
	const isCardGrid = view === Views.MONTH || view === Views.AGENDA || view === Views.WORK_WEEK;

	const { defaultDate, minTime, maxTime } = useMemo(
		() => ({
			defaultDate: events.length > 0 ? events[0].start : new Date(),
			minTime: new Date(1970, 0, 1, 8, 0, 0),
			maxTime: new Date(1970, 0, 1, 22, 0, 0),
		}),
		[events],
	);

	const eventPropGetter = (event: CalendarEvent) => {
		if (event.resource?.eventType === "deadline") {
			const isPast = event.end < new Date();
			return {
				className: "event-deadline",
				style: { opacity: isPast ? 0.82 : 1, filter: isPast ? "grayscale(20%)" : "none" },
			};
		}

		const colorIndex = event.resource?.colorIndex ?? 0;
		const isFinished = event.resource?.status === "FINISHED" || (event.resource?.status === "UPCOMING" && event.end < new Date());
		const isCancelled = event.resource?.status === "CANCELED";
		const isAbsent = event.resource?.status === "ABSENT";

		return {
			className: `event-color-${colorIndex} ${isFinished ? "event-finished" : ""} ${isCancelled ? "event-canceled" : ""} ${isAbsent ? "event-absent" : ""}`,
		};
	};

	const handleKeyPressEvent = (event: CalendarEvent, keyEvent: SyntheticEvent<HTMLElement>) => {
		const key = (keyEvent as ReactKeyboardEvent<HTMLElement>).key;
		if (!isCalendarActivationKey(key)) return;
		keyEvent.preventDefault();
		onSelectEvent?.(event);
	};

	return (
		// The card-grid views size to their content and let the page scroll;
		// only the time-grid calendar needs to fill the workspace height.
		<div className={`flex-1 flex flex-col ${isCardGrid ? "" : "h-full"}`}>
			<UpcomingClasses events={events} onSelect={(event) => onSelectEvent?.(event)} />

			{/* Month and week are plain grids of class cards rather than
			    react-big-calendar's layouts, which cannot show course code, room and
			    status per class. Day stays on the time-grid calendar. */}
			{view === Views.MONTH ? (
				<TimetableMonthGrid events={events} date={date} onSelectEvent={onSelectEvent} />
			) : view === Views.AGENDA ? (
				<TimetableAgenda events={events} date={date} onSelectEvent={onSelectEvent} />
			) : view === Views.WORK_WEEK ? (
				<TimetableWeek events={events} date={date} onSelectEvent={onSelectEvent} />
			) : (
			<div className="calendar-surface flex-1 bg-surface overflow-hidden">
				<Calendar
					localizer={localizer}
					culture={dayjsLocale}
					events={events}
					startAccessor="start"
					endAccessor="end"
					view={view}
					onView={onViewChange}
					date={date}
					onNavigate={onNavigate}
					defaultDate={defaultDate}
					views={[Views.MONTH, Views.WORK_WEEK, Views.DAY, Views.AGENDA]}
					defaultView={Views.WORK_WEEK}
					style={{ height: "100%" }}
					min={minTime}
					max={maxTime}
					eventPropGetter={eventPropGetter}
					onSelectEvent={onSelectEvent}
					onKeyPressEvent={handleKeyPressEvent}
					selectable
					step={30}
					timeslots={1}
					tooltipAccessor={(event: CalendarEvent) => [
						event.title,
						event.resource?.location && `${tEvent("location")}: ${event.resource.location}`,
						event.resource?.lecturer && `${tEvent("lecturer")}: ${event.resource.lecturer}`,
						event.resource?.lessonType && `${tEvent("type")}: ${event.resource.lessonType}`,
					].filter(Boolean).join("\n")}
					formats={{
						eventTimeRangeFormat: () => "",
						timeGutterFormat: (value: Date) => dayjs(value).locale(dayjsLocale).format("HH:mm"),
						dayHeaderFormat: (value: Date) => dayjs(value).locale(dayjsLocale).format("ddd D"),
						dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
							`${dayjs(start).locale(dayjsLocale).format("MMM D")} – ${dayjs(end).locale(dayjsLocale).format("MMM D, YYYY")}`,
					}}
					components={{
						toolbar: () => null,
						event: ({ event }: { event: CalendarEvent }) => {
							if (event.resource?.eventType === "deadline") {
								return (
									<div className="calendar-deadline-card">
										<strong><span aria-hidden="true">⚑</span>{event.title}</strong>
										<small>{event.resource.courseCode}</small>
									</div>
								);
							}
							return <CalendarEventCard event={event} density={getCalendarEventDensity(event.start, event.end)} />;
						},
					}}
				/>
			</div>
			)}
		</div>
	);
}
