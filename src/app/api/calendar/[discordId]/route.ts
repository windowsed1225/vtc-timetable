import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import Event, { IEvent } from "@/models/Event";
import { createEvents, EventAttributes } from "ics";

/**
 * Calendar Subscription Feed (WebCal)
 * 
 * SECURITY NOTE:
 * This endpoint is intentionally unauthenticated because calendar apps
 * (Apple Calendar, Google Calendar, Outlook) cannot perform OAuth login.
 * The discordId in the URL acts as a "secret" identifier.
 * 
 * Anyone with this URL can access the user's calendar events.
 * This is the standard trade-off for calendar subscription feeds.
 * 
 * Consider: Adding an optional secret token per user for extra security.
 */

// Helper to convert Date to ICS date array format
function getDateArray(date: Date): [number, number, number, number, number] {
    return [
        date.getFullYear(),
        date.getMonth() + 1, // ICS months are 1-indexed
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
    ];
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ discordId: string }> }
) {
    try {
        const { discordId } = await params;

        if (!discordId) {
            return NextResponse.json(
                { error: "Missing discordId parameter" },
                { status: 400 }
            );
        }

        // Get optional semester filter from query params
        const { searchParams } = new URL(request.url);
        const semesterFilter = searchParams.get("semester"); // e.g., "SEM 1", "SEM 2", "SEM 3"

        // Connect to MongoDB
        await connectDB();

        // Fetch user to get vtcStudentId
        const User = (await import("@/models/User")).default;
        const user = await User.findOne({ discordId }).lean();
        if (!user?.vtcStudentId) {
            // Return empty calendar if user not found or no VTC data
            const emptyCalendar = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//VTC Timetable//EN",
                "CALSCALE:GREGORIAN",
                "METHOD:PUBLISH",
                "X-WR-CALNAME:VTC Timetable",
                "END:VCALENDAR",
            ].join("\r\n");

            return new NextResponse(emptyCalendar, {
                status: 200,
                headers: {
                    "Content-Type": "text/calendar; charset=utf-8",
                    "Content-Disposition": 'attachment; filename="vtc-schedule.ics"',
                    "Cache-Control": "s-maxage=3600, stale-while-revalidate",
                },
            });
        }
        const vtcStudentId = user.vtcStudentId;

        // Build query - optionally filter by semester
        const query: { vtcStudentId: string; semester?: string } = { vtcStudentId };
        if (semesterFilter && ["SEM 1", "SEM 2", "SEM 3"].includes(semesterFilter)) {
            query.semester = semesterFilter;
        }

        // Fetch events for this user (optionally filtered by semester)
        const events = await Event.find(query)
            .sort({ startTime: 1 })
            .lean<IEvent[]>();

        if (events.length === 0) {
            // Return empty calendar if no events
            const emptyCalendar = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//VTC Timetable//EN",
                "CALSCALE:GREGORIAN",
                "METHOD:PUBLISH",
                "X-WR-CALNAME:VTC Timetable",
                "END:VCALENDAR",
            ].join("\r\n");

            return new NextResponse(emptyCalendar, {
                status: 200,
                headers: {
                    "Content-Type": "text/calendar; charset=utf-8",
                    "Content-Disposition": 'attachment; filename="vtc-schedule.ics"',
                    "Cache-Control": "s-maxage=3600, stale-while-revalidate",
                },
            });
        }

        // Transform MongoDB events to ICS format
        const icsEvents: EventAttributes[] = events.map((event) => ({
            uid: event.vtc_id + "@vtc-timetable",
            title: `${event.courseTitle} (${event.courseCode})`,
            start: getDateArray(new Date(event.startTime)),
            end: getDateArray(new Date(event.endTime)),
            location: event.location || undefined,
            description: [
                event.lessonType ? `Type: ${event.lessonType}` : "",
                event.location ? `Location: ${event.location}` : "",
                event.lecturerName ? `Lecturer: ${event.lecturerName}` : "",
                event.startTime ? `Time: ${new Date(Number(event.startTime)).toLocaleString()} - ${new Date(Number(event.endTime)).toLocaleString()}` : "",

            ]
                .filter(Boolean)
                .join("\n"),
            categories: [event.courseCode, event.semester],
            status: event.status === "FINISHED" ? "CONFIRMED" : "CONFIRMED",
        }));

        // Generate ICS string
        const { error, value } = createEvents(icsEvents);

        if (error || !value) {
            console.error("Error generating ICS:", error);
            return NextResponse.json(
                { error: "Failed to generate calendar" },
                { status: 500 }
            );
        }

        // Return the ICS file with proper headers
        return new NextResponse(value, {
            status: 200,
            headers: {
                "Content-Type": "text/calendar; charset=utf-8",
                "Content-Disposition": 'attachment; filename="vtc-schedule.ics"',
                "Cache-Control": "s-maxage=3600, stale-while-revalidate",
            },
        });
    } catch (error) {
        console.error("Calendar subscription error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
