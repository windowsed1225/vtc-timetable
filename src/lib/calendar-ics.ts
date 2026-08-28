import { normalizeSemester, semesterTag } from "@/lib/semester";
import type { EventAttributes } from "ics";

export type CalendarIcsEvent = {
	vtc_id: string;
	courseTitle: string;
	courseCode: string;
	startTime: Date | string | number;
	endTime: Date | string | number;
	location?: string | null;
	lecturerName?: string | null;
	semester: unknown;
};

function getDateArray(date: Date): [number, number, number, number, number] {
	return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()];
}

function semesterCategory(semester: unknown): string {
	const n = normalizeSemester(semester);
	return n ? semesterTag(n) : String(semester);
}

export function eventToIcsAttributes(event: CalendarIcsEvent): EventAttributes {
	const start = new Date(event.startTime);
	const end = new Date(event.endTime);
	return {
		uid: `${event.vtc_id}@vtc-timetable`,
		title: `${event.courseTitle} (${event.courseCode})`,
		start: getDateArray(start),
		end: getDateArray(end),
		location: event.location || undefined,
		description: [
			event.lecturerName ? `Instructor: ${event.lecturerName}` : "",
			event.location ? `Room: ${event.location}` : "",
			`Time: ${start.toLocaleString()} - ${end.toLocaleString()}`,
		]
			.filter(Boolean)
			.join("\n"),
		categories: [event.courseCode, semesterCategory(event.semester)],
		status: "CONFIRMED",
	};
}
