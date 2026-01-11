"use client";

import { Calendar, dayjsLocalizer, Views, View } from "react-big-calendar";
import dayjs from "dayjs";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { CalendarEvent } from "@/types/timetable";
import { useMemo } from "react";
import { PASTEL_COLORS } from "@/lib/colors";
import CalendarHeader from "./CalendarHeader";

const localizer = dayjsLocalizer(dayjs);

interface TimetableCalendarProps {
    events: CalendarEvent[];
    view: View;
    date: Date;
    onViewChange: (view: View) => void;
    onNavigate: (date: Date) => void;
}

export default function TimetableCalendar({
    events,
    view,
    date,
    onViewChange,
    onNavigate,
}: TimetableCalendarProps) {
    const { defaultDate, minTime, maxTime } = useMemo(
        () => ({
            defaultDate: events.length > 0 ? events[0].start : new Date(),
            minTime: new Date(1970, 0, 1, 7, 0, 0), // 7 AM
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
                } else if (view === Views.WEEK) {
                    newDate = dayjs(date).subtract(1, "week").toDate();
                } else if (view === Views.DAY) {
                    newDate = dayjs(date).subtract(1, "day").toDate();
                }
                break;
            case "NEXT":
                if (view === Views.MONTH) {
                    newDate = dayjs(date).add(1, "month").toDate();
                } else if (view === Views.WEEK) {
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

    // Event styling with pastel colors
    const eventPropGetter = (event: CalendarEvent) => {
        const colorIndex = event.resource?.colorIndex ?? 0;
        const color = PASTEL_COLORS[colorIndex] || PASTEL_COLORS[0];

        // Determine text color based on background brightness
        const isDark = [0, 1, 2, 5, 8, 9].includes(colorIndex);

        return {
            className: `event-color-${colorIndex}`,
            style: {
                backgroundColor: color,
                color: isDark ? "white" : "#333",
                border: "none",
                borderRadius: "6px",
                padding: "2px 8px",
                fontSize: "12px",
                fontWeight: 500,
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

            <div className="flex-1 bg-white dark:bg-[var(--background)] rounded-xl overflow-hidden shadow-sm border border-[var(--calendar-border)]">
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
                    views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
                    style={{ height: "100%" }}
                    min={minTime}
                    max={maxTime}
                    eventPropGetter={eventPropGetter}
                    tooltipAccessor={(event) => {
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
                        timeGutterFormat: (date: Date) => dayjs(date).format("h A"),
                        dayHeaderFormat: (date: Date) => dayjs(date).format("ddd D"),
                        dayRangeHeaderFormat: ({ start, end }) =>
                            `${dayjs(start).format("MMM D")} – ${dayjs(end).format("MMM D, YYYY")}`,
                    }}
                    components={{
                        toolbar: () => null, // Hide default toolbar
                    }}
                />
            </div>
        </div>
    );
}
