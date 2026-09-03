"use client";

import { deleteEventsByDateRange, getUniqueCourses, previewDeleteEventsByDateRange } from "@/app/actions";
import AppShell from "@/components/AppShell";
import SessionSplash from "@/components/SessionSplash";
import SignInModal from "@/components/SignInModal";
import { useSession } from "@/lib/auth-client";
import { SEMESTER_ORDER, semesterI18nKey } from "@/lib/semester";
import { CalendarDays, Check, Search, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

interface CourseOption {
	courseCode: string;
	courseTitle: string;
	semester: string;
}

interface PreviewEvent {
	vtc_id: string;
	startTime: string;
	endTime: string;
}

const courseKey = (course: CourseOption) => `${course.courseCode}__${course.semester}`;

/**
 * `/events` — the scheduled-event cleanup that also lives in the timetable
 * header's Manage Events dialog, given a full page. The list is the user's own
 * synced events; nothing is removed until the confirm dialog is accepted.
 */
export default function EventsManagerPage() {
	const { data: session, isPending } = useSession();
	const t = useTranslations("eventsPage");
	const tCal = useTranslations("calendar");
	const tDash = useTranslations("dashboard");
	const locale = useLocale();

	const [courses, setCourses] = useState<CourseOption[]>([]);
	const [selectedSemester, setSelectedSemester] = useState("");
	const [selectedKey, setSelectedKey] = useState("");
	const [allEvents, setAllEvents] = useState<PreviewEvent[] | null>(null);
	const [query, setQuery] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [confirming, setConfirming] = useState<PreviewEvent | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!session) return;
		let cancelled = false;
		getUniqueCourses().then((result) => {
			if (cancelled || !result.success) return;
			setCourses(result.data ?? []);
		});
		return () => {
			cancelled = true;
		};
	}, [session]);

	const uniqueCourses = useMemo(() => {
		const seen = new Map<string, CourseOption>();
		for (const course of courses) if (!seen.has(courseKey(course))) seen.set(courseKey(course), course);
		return [...seen.values()];
	}, [courses]);

	const semesters = useMemo(() => {
		const set = [...new Set(uniqueCourses.map((c) => c.semester || "SEM 2"))];
		return set.toSorted((a, b) => (SEMESTER_ORDER[b] ?? 0) - (SEMESTER_ORDER[a] ?? 0));
	}, [uniqueCourses]);

	const coursesForSemester = useMemo(
		() => (selectedSemester ? uniqueCourses.filter((c) => c.semester === selectedSemester) : []),
		[uniqueCourses, selectedSemester],
	);

	const selectedCourse = uniqueCourses.find((c) => courseKey(c) === selectedKey) ?? null;

	useEffect(() => {
		setSelectedKey("");
	}, [selectedSemester]);

	// Load every scheduled event for the chosen course, the same preview the
	// Manage Events dialog runs.
	useEffect(() => {
		if (!selectedCourse) {
			setAllEvents(null);
			return;
		}
		let cancelled = false;
		setIsLoading(true);
		setAllEvents(null);
		setError(null);

		previewDeleteEventsByDateRange(selectedCourse.courseCode, selectedCourse.semester, new Date("2000-01-01"), new Date("2099-12-31"))
			.then((result) => {
				if (cancelled) return;
				if (!result.success) {
					setError(result.error ?? t("loadFailed"));
					return;
				}
				setAllEvents(result.events ?? []);
			})
			.catch(() => {
				if (!cancelled) setError(t("loadFailed"));
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [selectedCourse, t]);

	const dateLabel = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" }), [locale]);
	const timeLabel = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }), [locale]);

	const filtered = useMemo(() => {
		if (!allEvents) return [];
		const needle = query.trim().toLowerCase();
		if (!needle) return allEvents;
		return allEvents.filter((event) => {
			const haystack = `${selectedCourse?.courseCode ?? ""} ${selectedCourse?.courseTitle ?? ""} ${dateLabel.format(new Date(event.startTime))}`;
			return haystack.toLowerCase().includes(needle);
		});
	}, [allEvents, query, selectedCourse, dateLabel]);

	const removeEvent = async () => {
		if (!selectedCourse || !confirming) return;
		setIsDeleting(true);
		const from = new Date(confirming.startTime);
		from.setHours(0, 0, 0, 0);
		const to = new Date(confirming.startTime);
		to.setHours(23, 59, 59, 999);

		try {
			const result = await deleteEventsByDateRange(selectedCourse.courseCode, selectedCourse.semester, from, to);
			if (!result.success) {
				setError(result.error ?? t("deleteFailed"));
				return;
			}
			setAllEvents((events) => (events ?? []).filter((event) => event.vtc_id !== confirming.vtc_id));
		} catch {
			setError(t("deleteFailed"));
		} finally {
			setIsDeleting(false);
			setConfirming(null);
		}
	};

	if (isPending) return <SessionSplash />;

	if (!session) {
		return (
			<div className="attendance-signed-out">
				<h1>{t("pageTitle")}</h1>
				<p>{t("signInHint")}</p>
				<SignInModal isOpen onClose={() => {}} />
			</div>
		);
	}

	return (
		<AppShell footer={tDash("footer")}>
			<div className="space-y-5">
				{/* Header and pickers */}
				<section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-3">
							<span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary">
								<CalendarDays className="size-5" aria-hidden="true" />
							</span>
							<div className="min-w-0">
								<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("breadcrumb")}</p>
								<h1 className="text-2xl font-black">{t("pageTitle")}</h1>
								<p className="text-sm text-muted-foreground">{t("pageSubtitle")}</p>
							</div>
						</div>
						{allEvents !== null && (
							<span className="w-fit shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground">
								{t("eventCount", { count: allEvents.length })}
							</span>
						)}
					</div>

					<div className="mt-5 rounded-2xl border border-border bg-secondary/50 p-4">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
							<label className="flex-1">
								<span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{tCal("semester")}</span>
								<select
									value={selectedSemester}
									onChange={(event) => setSelectedSemester(event.target.value)}
									className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring"
								>
									<option value="">{t("chooseSemester")}</option>
									{semesters.map((semester) => (
										<option key={semester} value={semester}>
											{tCal(semesterI18nKey(semester))}
										</option>
									))}
								</select>
							</label>
							<label className="flex-1">
								<span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("chooseCourseLabel")}</span>
								<select
									value={selectedKey}
									onChange={(event) => setSelectedKey(event.target.value)}
									disabled={!selectedSemester}
									className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
								>
									<option value="">{t("chooseCourse")}</option>
									{coursesForSemester.map((course) => (
										<option key={courseKey(course)} value={courseKey(course)}>
											{course.courseCode} · {course.courseTitle}
										</option>
									))}
								</select>
							</label>
						</div>
						{selectedCourse && (
							<p className="mt-2 text-xs text-muted-foreground">
								{t("selectedClass")}: <span className="font-semibold text-foreground">{selectedCourse.courseTitle}</span>
							</p>
						)}
					</div>

					<div className="mt-5 flex flex-col gap-3 sm:flex-row">
						<label className="relative flex-1">
							<span className="sr-only">{t("searchLabel")}</span>
							<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
							<input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={t("searchPlaceholder")}
								disabled={!allEvents}
								className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
							/>
						</label>
					</div>
				</section>

				{/* Event list */}
				<section className="space-y-3">
					{error ? (
						<p className="rounded-3xl border border-error/30 bg-error/10 p-6 text-center text-sm text-error">{error}</p>
					) : isLoading ? (
						[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-3xl border border-border bg-card" />)
					) : !selectedCourse ? (
						<div className="rounded-3xl border border-dashed border-border p-12 text-center">
							<CalendarDays className="mx-auto size-8 text-primary" aria-hidden="true" />
							<p className="mt-3 font-bold">{t("emptyPickTitle")}</p>
							<p className="mt-1 text-sm text-muted-foreground">{t("emptyPickText")}</p>
						</div>
					) : filtered.length === 0 ? (
						<div className="rounded-3xl border border-dashed border-border p-12 text-center">
							<Check className="mx-auto size-8 text-primary" aria-hidden="true" />
							<p className="mt-3 font-bold">{t("emptyTitle")}</p>
							<p className="mt-1 text-sm text-muted-foreground">{t("emptyText")}</p>
						</div>
					) : (
						filtered.map((event) => (
							<article
								key={event.vtc_id}
								className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="flex items-start gap-4">
									<span aria-hidden="true" className="mt-1 size-3 shrink-0 rounded-full bg-primary" />
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<h2 className="font-black">{selectedCourse.courseCode}</h2>
										</div>
										<p className="mt-1 text-sm text-muted-foreground">{selectedCourse.courseTitle}</p>
										<div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
											<span>{dateLabel.format(new Date(event.startTime))}</span>
											<span>
												{timeLabel.format(new Date(event.startTime))}-{timeLabel.format(new Date(event.endTime))}
											</span>
										</div>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setConfirming(event)}
									className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-error/30 px-4 py-2.5 text-sm font-bold text-error transition hover:bg-error/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									<Trash2 className="size-4" aria-hidden="true" />
									{t("removeEvent")}
								</button>
							</article>
						))
					)}
				</section>
			</div>

			{confirming && (
				<div role="dialog" aria-modal="true" aria-label={t("removeTitle", { code: selectedCourse?.courseCode ?? "" })} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5">
					<div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<p className="text-xs font-bold uppercase tracking-widest text-error">{t("removeEvent")}</p>
								<h2 className="mt-1 text-xl font-black">{t("removeTitle", { code: selectedCourse?.courseCode ?? "" })}</h2>
							</div>
							<button type="button" aria-label={tCal("shareCalendarClose")} onClick={() => setConfirming(null)} className="rounded-xl p-2 transition hover:bg-secondary">
								<X className="size-5" aria-hidden="true" />
							</button>
						</div>
						<p className="mt-4 text-sm text-muted-foreground">{t("removeText", { date: dateLabel.format(new Date(confirming.startTime)) })}</p>
						<div className="mt-6 flex gap-3">
							<button type="button" onClick={() => setConfirming(null)} className="flex-1 rounded-2xl border border-border px-4 py-3 text-sm font-bold transition hover:bg-secondary">
								{t("keepEvent")}
							</button>
							<button
								type="button"
								onClick={removeEvent}
								disabled={isDeleting}
								className="flex-1 rounded-2xl bg-error px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
							>
								{isDeleting ? t("removing") : t("remove")}
							</button>
						</div>
					</div>
				</div>
			)}
		</AppShell>
	);
}
