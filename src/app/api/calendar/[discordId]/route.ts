import { NextRequest, NextResponse } from "next/server";
import { eventToIcsAttributes } from "@/lib/calendar-ics";
import connectDB from "@/lib/db";
import { normalizeSemester, semesterTag } from "@/lib/semester";
import Event, { IEvent } from "@/models/Event";
import { createEvents } from "ics";

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
        const query: { vtcStudentId: string; semester?: { $in: Array<number | string> } } = { vtcStudentId };
        const semesterNum = semesterFilter ? normalizeSemester(semesterFilter) : null;
        if (semesterNum) {
            query.semester = { $in: [semesterNum, semesterTag(semesterNum)] };
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

        const icsEvents = events.map((event) => eventToIcsAttributes(event));

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
