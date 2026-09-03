"use client";

import { getCourseHoursBreakdown, getHybridAttendanceStats, getStoredEvents, type HybridAttendanceStats } from "@/app/actions";
import { LINE_COLORS, getColorIndex } from "@/lib/colors";
import { APP_TIME_ZONE } from "@/lib/event-date";
import { Link } from "@/lib/navigation";
import { skipProjection } from "@/lib/skip-projection";
import type { CalendarEvent } from "@/types/timetable";
import { ArrowLeft, Calculator, CircleAlert, CircleCheck, Clock3, MapPin, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

interface CourseDetailViewProps {
	/** Canonical course code, or null when the URL segment was not a course code. */
	courseId: string | null;
}

interface DayRecord {
	date: string;
	minutes: number;
}

interface CourseData {
	courseTitle?: string;
	semester?: string;
	colorIndex?: number;
	upcoming: CalendarEvent[];
	futureCount: number;
	futureHours: number;
	totalCount: number;
	totalHours: number;
	attendance: HybridAttendanceStats | null;
	days: DayRecord[];
	totalMinutes: number;
}

const EMPTY: CourseData = {
	upcoming: [],
	futureCount: 0,
	futureHours: 0,
	totalCount: 0,
	totalHours: 0,
	attendance: null,
	days: [],
	totalMinutes: 0,
};

/** Upcoming-class cards the panel shows before it starts counting the rest. */
const UPCOMING_LIMIT = 6;

/** Scheduled hours across a set of events. */
function hoursOf(events: CalendarEvent[]): number {
	return events.reduce((sum, event) => sum + (event.end.getTime() - event.start.getTime()), 0) / 3_600_000;
}

export default function CourseDetailView({ courseId }: CourseDetailViewProps) {
	const t = useTranslations("courseDetail");
	const tSkip = useTranslations("skipping");
	const locale = useLocale();
	const [data, setData] = useState<CourseData>(EMPTY);
	const [loading, setLoading] = useState(courseId !== null);
	const [notFound, setNotFound] = useState(courseId === null);
	const [error, setError] = useState<string | null>(null);
	const [skip, setSkip] = useState(0);
	// Minutes is the default unit; the toggle switches the breakdown to hours.
	const [unit, setUnit] = useState<"minutes" | "hours">("minutes");

	useEffect(() => {
		if (courseId === null) return;
		let active = true;

		Promise.all([getStoredEvents(), getHybridAttendanceStats(), getCourseHoursBreakdown(courseId)])
			.then(([eventsResult, statsResult, breakdownResult]) => {
				if (!active) return;
				if (!eventsResult.success || !statsResult.success || !breakdownResult.success) {
					setError(breakdownResult.error ?? eventsResult.error ?? statsResult.error ?? t("loadFailed"));
					return;
				}

				const courseEvents = (eventsResult.data ?? []).filter((event) => event.resource?.courseCode === courseId);
				const attendance = (statsResult.data ?? []).find((stat) => stat.courseCode === courseId || stat.baseCourseCode === courseId) ?? null;
				const days = breakdownResult.days ?? [];

				// Nothing in the calendar, the attendance record, or the hours
				// breakdown carries this code, so it is unknown to this account.
				if (courseEvents.length === 0 && !attendance && days.length === 0 && !breakdownResult.courseName) {
					setNotFound(true);
					return;
				}

				const now = Date.now();
				const future = courseEvents.filter((event) => event.start.getTime() > now).toSorted((a, b) => a.start.getTime() - b.start.getTime());
				const latest = courseEvents[courseEvents.length - 1]?.resource;

				setData({
					courseTitle: breakdownResult.courseName ?? attendance?.courseName ?? latest?.courseTitle,
					semester: attendance?.displaySemester ?? attendance?.semester ?? latest?.semester,
					colorIndex: latest?.colorIndex,
					upcoming: future,
					futureCount: future.length,
					futureHours: hoursOf(future),
					totalCount: courseEvents.length,
					totalHours: hoursOf(courseEvents),
					attendance,
					days,
					totalMinutes: breakdownResult.totalMinutes ?? 0,
				});
			})
			.catch(() => {
				if (active) setError(t("loadFailed"));
			})
			.finally(() => {
				if (active) setLoading(false);
			});

		return () => {
			active = false;
		};
	}, [courseId, t]);

	const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: APP_TIME_ZONE }), [locale]);
	const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: APP_TIME_ZONE }), [locale]);

	const projection = data.attendance ? skipProjection(data.attendance, skip) : null;
	const dotColor = LINE_COLORS[data.colorIndex ?? getColorIndex(courseId ?? "")] ?? LINE_COLORS[0];

	const breakdownHours = data.totalMinutes / 60;
	const fmt = (minutes: number) => (unit === "minutes" ? `${Math.round(minutes)}` : (minutes / 60).toFixed(1));
	const unitSuffix = unit === "minutes" ? "m" : "h";
	const unitLabel = unit === "minutes" ? t("minutes") : t("hours");

	if (notFound || error) {
		return (
			<CourseDetailShell>
				<section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
					<h1 className="text-2xl font-black tracking-tight">{error ? t("loadFailed") : t("notFoundTitle")}</h1>
					<p className="mt-2 text-sm text-muted-foreground">{error ? t("loadFailedHint") : t("notFoundHint", { code: courseId ?? "" })}</p>
					<Link
						href="/attendance"
						className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.98]"
					>
						<ArrowLeft className="size-4" aria-hidden="true" />
						{t("backToAttendance")}
					</Link>
				</section>
			</CourseDetailShell>
		);
	}

	return (
		<CourseDetailShell>
			<section className="rounded-4xl border border-border bg-card p-5 shadow-sm sm:p-7">
				{/* Course header */}
				<div className="flex items-start justify-between gap-4 border-b border-border pb-6">
					<div className="flex gap-3">
						<span aria-hidden="true" className="mt-2 size-3 shrink-0 rounded-full" style={{ background: dotColor }} />
						<div className="min-w-0">
							<p className="font-mono text-xs font-bold tracking-widest text-primary">{courseId}</p>
							<h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
								{loading ? <span className="inline-block h-7 w-56 max-w-full animate-pulse rounded-lg bg-secondary align-middle" /> : (data.courseTitle ?? t("subtitle"))}
							</h1>
							<p className="mt-1 text-sm text-muted-foreground">{data.semester ?? t("courseLabel")}</p>
						</div>
					</div>
					<Link href="/attendance" aria-label={t("closeDetails")} className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground">
						<X className="size-5" aria-hidden="true" />
					</Link>
				</div>

				<div className="mt-6 grid gap-4 md:grid-cols-[1fr_1.25fr]">
					{/* Summary statistics and skipping calculator */}
					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-2xl bg-secondary p-4">
								<p className="text-3xl font-black tabular-nums">{loading ? "-" : data.futureCount}</p>
								<p className="text-xs text-muted-foreground">{t("futureClasses")}</p>
							</div>
							<div className="rounded-2xl bg-secondary p-4">
								<p className="text-3xl font-black tabular-nums">{loading ? "-" : data.futureHours.toFixed(1)}</p>
								<p className="text-xs text-muted-foreground">{t("hoursRemaining")}</p>
							</div>
						</div>

						<div className="flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
							<span className="text-muted-foreground">{t("totalScheduled")}</span>
							<strong className="text-right tabular-nums">{t("totalScheduledValue", { classes: data.totalCount, hours: data.totalHours.toFixed(1) })}</strong>
						</div>

						{projection && (
							<div className="rounded-2xl border border-border p-4">
								<div className="mb-3 flex items-center justify-between gap-3">
									<div className="flex items-center gap-2 text-sm font-bold">
										<Calculator className="size-4 text-primary" aria-hidden="true" />
										{t("skippingTitle")}
									</div>
									<span className="rounded-full bg-highlight/15 px-2 py-1 text-[11px] font-bold text-highlight-fg">{t("currentRate", { rate: projection.currentRate.toFixed(1) })}</span>
								</div>

								<label htmlFor="skip-classes" className="block text-sm text-muted-foreground">
									{t("howManySkip")}
								</label>
								<div className="mt-4 flex items-center gap-3">
									<input
										id="skip-classes"
										type="range"
										min={0}
										max={projection.sliderMax}
										step={1}
										value={skip}
										onChange={(event) => setSkip(Number(event.target.value))}
										className="accent-primary w-full cursor-pointer"
									/>
									<span className="w-9 shrink-0 rounded-lg bg-secondary px-2 py-1 text-center text-sm font-bold tabular-nums">{skip}</span>
								</div>

								<div className="mt-4 rounded-2xl bg-primary/10 p-4">
									<div className="flex items-center justify-between gap-3">
										<span className="text-sm font-semibold">{t("projectedFinalRate")}</span>
										<strong className="text-xl text-primary tabular-nums">{projection.projectedRate.toFixed(1)}%</strong>
									</div>
									<p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
										{projection.isSafe ? (
											<>
												<CircleCheck className="size-4 shrink-0 text-chart-4" aria-hidden="true" />
												{t("safeToSkipRemaining", { count: projection.remainingSafeSkips })}
											</>
										) : (
											<>
												<CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
												{tSkip("danger", { threshold: projection.threshold })}
											</>
										)}
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Upcoming classes */}
					<div>
						<div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
							<Clock3 className="size-4 text-primary" aria-hidden="true" />
							<h2 className="font-bold">{t("upcomingClasses")}</h2>
						</div>
						<div className="flex flex-col gap-3">
							{loading ? (
								[0, 1, 2].map((key) => <div key={key} className="h-18.5 animate-pulse rounded-2xl bg-secondary" />)
							) : data.upcoming.length === 0 ? (
								<p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">{t("noUpcomingClasses")}</p>
							) : (
								<>
									{data.upcoming.slice(0, UPCOMING_LIMIT).map((event) => (
										<div key={`${event.start.toISOString()}-${event.resource?.location ?? ""}`} className="rounded-2xl bg-secondary p-4">
											<div className="flex items-start justify-between gap-4">
												<div className="min-w-0">
													<strong className="text-sm">{dateFormat.format(event.start)}</strong>
													<p className="mt-1 text-xs text-muted-foreground">
														{timeFormat.format(event.start)} - {timeFormat.format(event.end)}
													</p>
												</div>
												{event.resource?.location && (
													<span className="flex min-w-0 items-center gap-1 text-right text-[11px] text-muted-foreground">
														<MapPin className="size-3 shrink-0 text-highlight" aria-hidden="true" />
														<span className="wrap-break-word">{event.resource.location}</span>
													</span>
												)}
											</div>
										</div>
									))}
									{data.upcoming.length > UPCOMING_LIMIT && (
										<p className="text-center text-xs text-muted-foreground">{t("moreClasses", { count: data.upcoming.length - UPCOMING_LIMIT })}</p>
									)}
								</>
							)}
						</div>

						{/* Bottom statistics */}
						<div className="mt-5 grid grid-cols-2 gap-3">
							<div className="rounded-2xl bg-muted p-4">
								<p className="text-xs text-muted-foreground">{t("attendedClasses")}</p>
								<p className="mt-1 text-lg font-black tabular-nums">{projection ? projection.attendedCount : "-"}</p>
							</div>
							<div className="rounded-2xl bg-muted p-4">
								<p className="text-xs text-muted-foreground">{projection ? t("requiredAt", { threshold: projection.threshold }) : t("requiredAtUnknown")}</p>
								<p className="mt-1 text-lg font-black tabular-nums">{projection ? t("requiredClassesValue", { count: projection.requiredClasses }) : "-"}</p>
							</div>
						</div>
					</div>
				</div>

				{/* Daily hours breakdown */}
				<div className="mt-5 rounded-2xl border border-border p-4">
					<div className="flex items-center justify-between gap-3">
						<h2 className="font-bold">{t("breakdownTitle")}</h2>
						<button
							type="button"
							onClick={() => setUnit((current) => (current === "minutes" ? "hours" : "minutes"))}
							className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold transition hover:bg-muted active:scale-[0.98]"
						>
							{unit === "minutes" ? t("showHours") : t("showMinutes")}
						</button>
					</div>

					<div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm">
						<span className="text-muted-foreground">{t("totalTime")}</span>
						<strong className="text-right tabular-nums">
							{fmt(data.totalMinutes)} {unitLabel}
							<span className="ml-2 font-normal text-muted-foreground">
								{unit === "minutes" ? t("equalsHours", { hours: breakdownHours.toFixed(1) }) : t("equalsMinutes", { minutes: data.totalMinutes })}
							</span>
						</strong>
					</div>

					<div className="mt-3 flex flex-col gap-2">
						{loading ? (
							[0, 1, 2].map((key) => <div key={key} className="h-11 animate-pulse rounded-2xl bg-secondary" />)
						) : data.days.length === 0 ? (
							<p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">{t("noRecords")}</p>
						) : (
							data.days.map((record) => (
								<div key={record.date} className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-2.5 text-sm">
									<span>{record.date}</span>
									<strong className="font-mono tabular-nums">
										{fmt(record.minutes)}
										<span className="ml-1 font-normal text-muted-foreground">{unitSuffix}</span>
									</strong>
								</div>
							))
						)}
					</div>
				</div>
			</section>
		</CourseDetailShell>
	);
}

/** Page frame: page background, centered column, back row and details pill. */
function CourseDetailShell({ children }: { children: React.ReactNode }) {
	const t = useTranslations("courseDetail");
	return (
		<main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-8 sm:py-8">
			<div className="mx-auto max-w-5xl">
				<header className="mb-5 flex items-center justify-between gap-3">
					<Link
						href="/attendance"
						className="inline-flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-muted-foreground transition hover:bg-card hover:text-foreground active:scale-[0.98]"
					>
						<ArrowLeft className="size-4" aria-hidden="true" />
						{t("backToAttendance")}
					</Link>
					<span className="rounded-full bg-highlight/15 px-3 py-1.5 text-xs font-semibold text-highlight-fg">{t("pill")}</span>
				</header>
				{children}
			</div>
		</main>
	);
}
