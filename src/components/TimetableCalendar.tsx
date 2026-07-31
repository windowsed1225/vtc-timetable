"use client";

import { CalendarEvent } from "@/types/timetable";
import dayjs from "dayjs";
import "dayjs/locale/zh-hk";
import { useEffect, useMemo } from "react";
import { Calendar, dayjsLocalizer, View, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import CalendarHeader from "./CalendarHeader";

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
    // Set dayjs locale for calendar month/weekday names
    useEffect(() => {
        const dayjsLocale = locale === "zh-HK" ? "zh-hk" : "en";
        dayjs.locale(dayjsLocale);
    }, [locale]);
    const { defaultDate, minTime, maxTime } = useMemo(
        () => ({
            defaultDate: events.length > 0 ? events[0].start : new Date(),
            minTime: new Date(1970, 0, 1, 8, 0, 0), // 8 AM
            maxTime: new Date(1970, 0, 1, 22, 0, 0), // 10 PM
        }),
        [events]
    );

    // Navigation handlers for custom header
    const handleNavigate = (action: "PREV" | "NEXT" | "TODAY") => {
        let newDate = date;
        switch (action) {
            case "PREV":
                if (view === Views.MONTH) {
                    newDate = dayjs(date).subtract(1, "month").toDate();
                } else if (view === Views.WEEK || view === Views.WORK_WEEK) {
                    newDate = dayjs(date).subtract(1, "week").toDate();
                } else if (view === Views.DAY) {
                    newDate = dayjs(date).subtract(1, "day").toDate();
                }
                break;
            case "NEXT":
                if (view === Views.MONTH) {
                    newDate = dayjs(date).add(1, "month").toDate();
                } else if (view === Views.WEEK || view === Views.WORK_WEEK) {
                    newDate = dayjs(date).add(1, "week").toDate();
                } else if (view === Views.DAY) {
                    newDate = dayjs(date).add(1, "day").toDate();
                }
                break;
            case "TODAY":
                newDate = new Date();
                break;
        }
        onNavigate(newDate);
    };

    // Event styling with pastel colors and finished state
    const eventPropGetter = (event: CalendarEvent) => {
        // Moodle deadline — distinct red-orange style
        if (event.resource?.eventType === "deadline") {
            const now = new Date();
            const isPast = event.end < now;
            return {
                className: "event-deadline",
                style: {
                    borderRadius: "8px",
                    padding: "4px 8px 4px 13px",
                    fontSize: "12px",
                    fontWeight: 700,
                    opacity: isPast ? 0.82 : 1,
                    filter: isPast ? "grayscale(20%)" : "none",
                },
            };
        }

        const colorIndex = event.resource?.colorIndex ?? 0;
        const now = new Date();
        // Event is finished if status says so OR if end time has passed
        const isFinished = event.resource?.status === "FINISHED" || (event.resource?.status === "UPCOMING" && event.end < now);
        const isCanceled = event.resource?.status === "CANCELED";
        const isMarkedAbsent = event.resource?.status === "ABSENT";

        return {
            className: `event-color-${colorIndex} ${isFinished ? "event-finished" : ""} ${isCanceled ? "event-canceled" : ""} ${isMarkedAbsent ? "event-absent" : ""}`,
            style: {
                backgroundImage: isMarkedAbsent
                    ? `repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(220, 38, 38, 0.32) 4px, rgba(220, 38, 38, 0.32) 8px)` 
                    : "none",
                borderRadius: "8px",
                padding: "4px 8px 4px 13px",
                fontSize: "12px",
                fontWeight: 700,
                opacity: (isFinished || isCanceled) ? 0.82 : 1,
                filter: isFinished ? "grayscale(20%)" : "none",
                textDecoration: isCanceled ? "line-through" : "none",
            },
        };
    };

    return (
        <div className="flex-1 flex flex-col h-full">
            <CalendarHeader
                date={date}
                view={view}
                onNavigate={handleNavigate}
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
                    tooltipAccessor={(event: CalendarEvent) => {
                        const parts = [event.title];
                        if (event.resource?.location) {
                            parts.push(`📍 ${event.resource.location}`);
                        }
                        if (event.resource?.lecturer) {
                            parts.push(`👤 ${event.resource.lecturer}`);
                        }
                        if (event.resource?.lessonType) {
                            parts.push(`📚 ${event.resource.lessonType}`);
                        }
                        return parts.join("\n");
                    }}
                    formats={{
                        eventTimeRangeFormat: () => "",
                        timeGutterFormat: (date: Date) => dayjs(date).format("h:mm"),
                        dayHeaderFormat: (date: Date) => dayjs(date).format("ddd D"),
                        dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
                            `${dayjs(start).format("MMM D")} – ${dayjs(end).format("MMM D, YYYY")}`,
                    }}
                    components={{
                        toolbar: () => null, // Hide default toolbar
                        event: ({ event }: { event: CalendarEvent }) => {
                            if (event.resource?.eventType === "deadline") {
                                return (
                                    <div className="h-full flex flex-col overflow-hidden">
                                        <div className="font-semibold text-xs leading-tight flex items-center gap-1">
                                            <span>🚩</span>
                                            <span className="truncate">{event.title}</span>
                                        </div>
                                        <div className="text-[10px] opacity-80 truncate mt-0.5">
                                            {event.resource.courseCode}
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div className="h-full flex flex-col overflow-hidden">
                                    <div className="font-medium text-xs leading-tight">
                                        {event.resource?.status === "CANCELED" && <span className="mr-1">🚫</span>}
                                        {event.resource?.courseTitle || event.title}
                                        {event.resource?.courseCode && (
                                            <span className="opacity-70"> ({event.resource.courseCode})</span>
                                        )}
                                    </div>
                                    {event.resource?.isAdjusted && (
                                        <span className="ml-1 text-[10px]" title="Manually adjusted">⚡</span>
                                    )}
                                    {event.resource?.location && (
                                        <div className="text-[11px] opacity-80 mt-1 flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-3.5 w-3.5 shrink-0">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                                            </svg>
                                            <span className="truncate">{event.resource.location}</span>
                                        </div>
                                    )}
                                    {event.resource?.lecturer && (
                                        <div className="text-[11px] opacity-70 mt-0.5 flex items-center gap-1.5">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" className="h-3.5 w-3.5 shrink-0">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.118a7.5 7.5 0 0 1 15 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.5-1.632Z" />
                                            </svg>
                                            <span className="truncate">{event.resource.lecturer}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        },
                    }}
                />
            </div>
        </div>
    );
}







