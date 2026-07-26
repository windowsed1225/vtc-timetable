"use client";

import { getCourseHoursBreakdown } from "@/app/actions";
import { Link } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface CourseDetailViewProps {
	courseId: string;
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
	const [loading, setLoading] = useState(true);
	// Minutes is the default unit; the toggle switches the whole view to hours.
	const [unit, setUnit] = useState<"minutes" | "hours">("minutes");

	useEffect(() => {
		let active = true;
		getCourseHoursBreakdown(courseId)
			.then((result) => {
				if (!active || !result.success) return;
				setDays(result.days ?? []);
				setCourseName(result.courseName);
				setTotalMinutes(result.totalMinutes ?? 0);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [courseId]);

	const totalHours = totalMinutes / 60;

	// Format a minutes value in the active unit (minutes default, hours on toggle).
	const fmt = (minutes: number) => (unit === "minutes" ? `${Math.round(minutes)}` : (minutes / 60).toFixed(1));
	const unitSuffix = unit === "minutes" ? "m" : "h";
	const unitLabel = unit === "minutes" ? t("minutes") : t("hours");

	return (
		<div className="min-h-screen w-full bg-[var(--background)] text-[var(--foreground)]">
			<div className="mx-auto max-w-3xl px-5 py-8 space-y-6">
				{/* Back link */}
				<Link
					href="/attendance-grid"
					className="inline-flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-foreground"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
						<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
					</svg>
					{t("back")}
				</Link>

				{/* Header card */}
				<div className="rounded-2xl border border-border bg-surface p-6">
					<p className="font-display text-xs font-medium uppercase tracking-wider text-text-tertiary">{t("courseLabel")}</p>
					<h1 className="font-display mt-1 text-3xl font-bold tracking-tight text-foreground">{courseId}</h1>
					<p className="mt-1 text-sm text-text-secondary">{courseName ?? t("subtitle")}</p>
				</div>

				{/* Statistics widget */}
				<div className="rounded-2xl border border-border bg-overlay p-6">
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
							<p className="font-mono mt-1 text-4xl font-bold tracking-tight text-[var(--accent-blue)]">
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
				<div className="rounded-2xl border border-border bg-surface overflow-hidden">
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
