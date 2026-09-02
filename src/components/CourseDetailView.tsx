"use client";

import { getCourseHoursBreakdown } from "@/app/actions";
import { Link } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface CourseDetailViewProps {
	/** Canonical course code, or null when the URL segment was not a course code. */
	courseId: string | null;
}

interface DayRecord {
	date: string;
	minutes: number;
}

export default function CourseDetailView({ courseId }: CourseDetailViewProps) {
	const t = useTranslations("courseDetail");
	const [days, setDays] = useState<DayRecord[]>([]);
	const [courseName, setCourseName] = useState<string | undefined>();
	const [totalMinutes, setTotalMinutes] = useState(0);
	const [loading, setLoading] = useState(courseId !== null);
	const [notFound, setNotFound] = useState(courseId === null);
	const [error, setError] = useState<string | null>(null);
	// Minutes is the default unit; the toggle switches the whole view to hours.
	const [unit, setUnit] = useState<"minutes" | "hours">("minutes");

	useEffect(() => {
		if (courseId === null) return;
		let active = true;
		getCourseHoursBreakdown(courseId)
			.then((result) => {
				if (!active) return;
				if (!result.success) {
					setError(result.error ?? t("loadFailed"));
					return;
				}
				// No stored event ever carried this code, so the course is unknown
				// to this account rather than merely having nothing attended yet.
				if (!result.courseName && (result.days ?? []).length === 0) {
					setNotFound(true);
					return;
				}
				setDays(result.days ?? []);
				setCourseName(result.courseName);
				setTotalMinutes(result.totalMinutes ?? 0);
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

	const totalHours = totalMinutes / 60;

	// Format a minutes value in the active unit (minutes default, hours on toggle).
	const fmt = (minutes: number) => (unit === "minutes" ? `${Math.round(minutes)}` : (minutes / 60).toFixed(1));
	const unitSuffix = unit === "minutes" ? "m" : "h";
	const unitLabel = unit === "minutes" ? t("minutes") : t("hours");

	if (notFound || error) {
		return (
			<div className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
				<div className="course-detail-main">
					<Link href="/attendance" className="attendance-grid-back">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
						</svg>
						{t("back")}
					</Link>
					<div className="attendance-empty">
						<h2>{error ? t("loadFailed") : t("notFoundTitle")}</h2>
						<p>{error ? t("loadFailedHint") : t("notFoundHint", { code: courseId ?? "" })}</p>
						<Link href="/attendance" className="btn-primary">
							{t("backToAttendance")}
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
			<div className="course-detail-main">
				{/* Back link */}
				<Link
					href="/attendance"
					className="attendance-grid-back"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
						<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
					</svg>
					{t("back")}
				</Link>

				{/* Header card */}
				<div className="course-detail-header">
					<span aria-hidden="true" className="course-detail-dot" />
					<div className="min-w-0">
						<p className="course-detail-code">{courseId}</p>
						<h1>{courseName ?? t("subtitle")}</h1>
						<p className="course-detail-lede">{t("courseLabel")}</p>
					</div>
				</div>

				{/* Statistics widget */}
				<div className="course-detail-stat">
					<div className="flex items-start justify-between gap-3">
						<p className="text-sm font-medium text-text-secondary">{t("totalTime")}</p>
						{/* Unit toggle — minutes is the default, press to switch to hours */}
						<button
							type="button"
							onClick={() => setUnit((u) => (u === "minutes" ? "hours" : "minutes"))}
							className="rounded-lg border border-border-strong bg-active px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
						>
							{unit === "minutes" ? t("showHours") : t("showMinutes")}
						</button>
					</div>
					{loading ? (
						<div className="mt-2 h-10 w-32 animate-pulse rounded-lg bg-active" />
					) : (
						<>
							<p className="course-detail-value">
								{fmt(totalMinutes)} <span className="text-2xl font-semibold text-text-secondary">{unitLabel}</span>
							</p>
							<p className="mt-1 text-sm text-text-tertiary">
								{unit === "minutes"
									? t("equalsHours", { hours: totalHours.toFixed(1) })
									: t("equalsMinutes", { minutes: totalMinutes })}
							</p>
						</>
					)}
				</div>

				{/* Daily breakdown */}
				<div className="course-detail-table">
					<div className="border-b border-border px-5 py-3">
						<h2 className="font-display text-sm font-semibold text-foreground">{t("breakdownTitle")}</h2>
					</div>
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b border-border bg-[var(--calendar-header-bg)] text-left">
								<th className="font-display px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-text-secondary">{t("colDay")}</th>
								<th className="font-display px-5 py-2.5 text-right text-xs font-bold uppercase tracking-wider text-text-secondary">{unitLabel}</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={2} className="px-5 py-10 text-center text-text-tertiary">…</td>
								</tr>
							) : days.length === 0 ? (
								<tr>
									<td colSpan={2} className="px-5 py-10 text-center text-sm text-text-tertiary">{t("noRecords")}</td>
								</tr>
							) : (
								days.map((record) => (
									<tr key={record.date} className="border-b border-border-subtle transition-colors last:border-0 hover:bg-overlay">
										<td className="px-5 py-3 text-foreground">{record.date}</td>
										<td className="px-5 py-3 text-right tabular-nums font-mono text-foreground">
											{fmt(record.minutes)}
											<span className="ml-1 text-text-tertiary">{unitSuffix}</span>
										</td>
									</tr>
								))
							)}
						</tbody>
						{!loading && days.length > 0 && (
							<tfoot>
								<tr className="border-t border-border bg-[var(--calendar-header-bg)]">
									<td className="px-5 py-3 font-medium text-text-secondary">{t("totalTime")}</td>
									<td className="px-5 py-3 text-right font-semibold tabular-nums font-mono text-foreground">
										{fmt(totalMinutes)}
										<span className="ml-1 text-text-tertiary">{unitSuffix}</span>
									</td>
								</tr>
							</tfoot>
						)}
					</table>
				</div>
			</div>
		</div>
	);
}
