"use client";

import { getCalendarEventDensity } from "@/lib/utils";
import type { CalendarEvent } from "@/types/timetable";
import dayjs from "dayjs";
import "dayjs/locale/zh-hk";
import { useEffect, useMemo } from "react";
import { Calendar, dayjsLocalizer, type View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CalendarEventCard from "./CalendarEventCard";
import CalendarHeader from "./CalendarHeader";

const localizer = dayjsLocalizer(dayjs);

interface TimetableCalendarProps {
	events: CalendarEvent[];
	view: View;
	date: Date;
	semesterFilter: string;
	onSemesterFilterChange: (semester: string) => void;
	onViewChange: (view: View) => void;
	onNavigate: (date: Date) => void;
	onSelectEvent?: (event: CalendarEvent) => void;
	locale?: string;
}

export default function TimetableCalendar({
	events,
	view,
	date,
	semesterFilter,
	onSemesterFilterChange,
	onViewChange,
	onNavigate,
	onSelectEvent,
	locale = "en",
}: TimetableCalendarProps) {
	useEffect(() => {
		dayjs.locale(locale === "zh-HK" ? "zh-hk" : "en");
	}, [locale]);

	const { defaultDate, minTime, maxTime } = useMemo(
		() => ({
			defaultDate: events.length > 0 ? events[0].start : new Date(),
			minTime: new Date(1970, 0, 1, 8, 0, 0),
			maxTime: new Date(1970, 0, 1, 22, 0, 0),
		}),
		[events],
	);

	const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
		let newDate = date;
		if (action === "TODAY") {
			newDate = new Date();
		} else {
			const amount = action === "PREV" ? -1 : 1;
			if (view === Views.MONTH) newDate = dayjs(date).add(amount, "month").toDate();
			else if (view === Views.WEEK || view === Views.WORK_WEEK) newDate = dayjs(date).add(amount, "week").toDate();
			else if (view === Views.DAY) newDate = dayjs(date).add(amount, "day").toDate();
		}
		onNavigate(newDate);
	};

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
			style: {
				backgroundImage: isAbsent
					? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(220, 38, 38, 0.22) 4px, rgba(220, 38, 38, 0.22) 8px)"
					: "none",
			},
		};
	};

	return (
		<div className="flex-1 flex flex-col h-full">
			<CalendarHeader
				date={date}
				view={view}
				semesterFilter={semesterFilter}
				onSemesterFilterChange={onSemesterFilterChange}
				onNavigate={handleNavigate}
				onDateSelect={onNavigate}
				onViewChange={onViewChange}
			/>

			<div className="calendar-surface flex-1 bg-surface overflow-hidden">
				<Calendar
					localizer={localizer}
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
					selectable
					step={30}
					timeslots={1}
					tooltipAccessor={(event: CalendarEvent) => [
						event.title,
						event.resource?.location && `Room: ${event.resource.location}`,
						event.resource?.lecturer && `Lecturer: ${event.resource.lecturer}`,
						event.resource?.lessonType && `Type: ${event.resource.lessonType}`,
					].filter(Boolean).join("\n")}
					formats={{
						eventTimeRangeFormat: () => "",
						timeGutterFormat: (value: Date) => dayjs(value).format("HH:mm"),
						dayHeaderFormat: (value: Date) => dayjs(value).format("ddd D"),
						dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
							`${dayjs(start).format("MMM D")} – ${dayjs(end).format("MMM D, YYYY")}`,
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
		</div>
	);
}
