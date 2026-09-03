"use client";

import { SEMESTER_ORDER, semesterI18nKey } from "@/lib/semester";
import type { CalendarEvent } from "@/types/timetable";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

interface SemesterCalendarCardProps {
	/** Every synced event, before the semester filter is applied. */
	events: CalendarEvent[];
	semesterFilter: string;
	onSemesterFilterChange: (semester: string) => void;
}

/**
 * "My calendar" summary above the timetable: which semester is in view, and how
 * many subjects and taught hours it holds. Both figures come from the user's
 * synced classes, so an unsynced account reads zero rather than a sample.
 */
export default function SemesterCalendarCard({
	events,
	semesterFilter,
	onSemesterFilterChange,
}: SemesterCalendarCardProps) {
	const t = useTranslations("calendar");

	// Only semesters the user has actually synced are offered, so the select
	// never lists an empty one.
	const semesters = useMemo(() => {
		const seen = new Set<string>();
		for (const event of events) {
			const semester = event.resource?.semester;
			if (semester) seen.add(semester);
		}
		return [...seen].sort((a, b) => (SEMESTER_ORDER[b] || 0) - (SEMESTER_ORDER[a] || 0));
	}, [events]);

	const summary = useMemo(() => {
		const classes = events.filter(
			(event) =>
				event.resource?.eventType !== "deadline" &&
				(semesterFilter === "all" || event.resource?.semester === semesterFilter),
		);
		const subjects = new Set<string>();
		let minutes = 0;
		for (const event of classes) {
			if (event.resource?.courseCode) subjects.add(event.resource.courseCode);
			minutes += (event.end.getTime() - event.start.getTime()) / 60000;
		}
		return { subjects: subjects.size, hours: Math.round(minutes / 6) / 10 };
	}, [events, semesterFilter]);

	const title = semesterFilter === "all" ? t("allSemesters") : t(semesterI18nKey(semesterFilter));

	return (
		<section className="mb-5 rounded-3xl border border-border bg-card p-4 sm:p-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="min-w-0">
					<p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
						{t("myCalendar")}
					</p>
					<h2 className="mt-1 text-lg font-black text-foreground">{title}</h2>
					<p className="text-xs text-muted-foreground">
						{t("calendarSummary", { subjects: summary.subjects, hours: summary.hours })}
					</p>
				</div>

				<label className="w-fit shrink-0">
					<span className="sr-only">{t("semester")}</span>
					<select
						value={semesterFilter}
						onChange={(event) => onSemesterFilterChange(event.target.value)}
						className="w-fit rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="all">{t("allSemesters")}</option>
						{semesters.map((semester) => (
							<option key={semester} value={semester}>
								{t(semesterI18nKey(semester))}
							</option>
						))}
					</select>
				</label>
			</div>
		</section>
	);
}
