"use client";

import { getHybridAttendanceStats, HybridAttendanceStats } from "@/app/actions";
import { useSession } from "@/lib/auth-client";
import { Link } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

/**
 * AttendanceExcelView — spreadsheet-style view of the signed-in student's
 * attended hours per course. The grid is a plain HTML table on purpose so it can
 * be swapped for a real data-grid library (AG Grid, TanStack Table, …) later.
 */
export default function AttendanceExcelView() {
	const t = useTranslations("attendanceGrid");
	const { data: session } = useSession();
	const [rows, setRows] = useState<HybridAttendanceStats[]>([]);
	const [loading, setLoading] = useState(true);

	const studentName = session?.user?.name ?? "—";

	useEffect(() => {
		let active = true;
		getHybridAttendanceStats()
			.then((result) => {
				if (active && result.success && result.data) setRows(result.data);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, []);

	const hoursAttended = (course: HybridAttendanceStats) =>
		((course.totalAttendedMinutes ?? 0) / 60).toFixed(1);

	return (
		<div className="flex h-screen w-full flex-col bg-[var(--background)] text-[var(--foreground)]">
			{/* Header */}
			<header className="shrink-0 border-b border-border bg-subtle/60 backdrop-blur-sm">
				<div className="flex items-center gap-3 px-5 py-4">
					<Link href="/" className="btn-icon" aria-label={t("back")}>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
						</svg>
					</Link>

					{/* Spreadsheet icon */}
					<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75zM3.75 9h16.5M3.75 14.25h16.5M9 3.75v16.5M15 3.75v16.5" />
						</svg>
					</span>

					<div className="min-w-0">
						<h1 className="font-display truncate text-lg font-semibold tracking-tight text-foreground">{t("title")}</h1>
						<p className="truncate text-sm text-text-secondary">{t("description")}</p>
					</div>
				</div>
			</header>

			{/* Grid area */}
			<main className="flex-1 overflow-auto p-5">
				<div className="overflow-hidden rounded-xl border border-border bg-surface">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b border-border bg-[var(--calendar-header-bg)] text-left">
								<th className="font-display px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{t("colStudent")}</th>
								<th className="font-display px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary">{t("colCourse")}</th>
								<th className="font-display px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary text-right">{t("colHours")}</th>
								<th className="font-display px-4 py-3 text-xs font-bold uppercase tracking-wider text-text-secondary text-right w-12"><span className="sr-only">{t("colView")}</span></th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={4} className="px-4 py-16">
										<div className="flex items-center justify-center gap-3 text-text-secondary">
											<span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent-blue)] border-t-transparent" />
											<span className="text-sm">{t("loading")}</span>
										</div>
									</td>
								</tr>
							) : rows.length === 0 ? (
								/* Empty state */
								<tr>
									<td colSpan={4} className="px-4 py-16">
										<div className="flex flex-col items-center justify-center gap-2 text-center">
											<span className="flex h-12 w-12 items-center justify-center rounded-full bg-overlay text-text-tertiary">
												<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
													<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75zM3.75 9h16.5M3.75 14.25h16.5M9 3.75v16.5M15 3.75v16.5" />
												</svg>
											</span>
											<p className="text-sm font-medium text-foreground">{t("emptyTitle")}</p>
											<p className="max-w-sm text-xs text-text-tertiary">{t("emptyDescription")}</p>
										</div>
									</td>
								</tr>
							) : (
								rows.map((course) => (
									<tr
										key={`${course.courseCode}-${course.semester}`}
										className="border-b border-border-subtle transition-colors last:border-0 hover:bg-overlay"
									>
										<td className="px-4 py-3 text-foreground">{studentName}</td>
										<td className="px-4 py-3">
											<span className="font-mono font-medium text-foreground">{course.courseCode}</span>
											{course.courseName && course.courseName !== course.courseCode && (
												<span className="ml-2 text-text-tertiary">{course.courseName}</span>
											)}
										</td>
										<td className="px-4 py-3 text-right tabular-nums font-mono text-foreground">
											{hoursAttended(course)}
											<span className="ml-1 text-text-tertiary">h</span>
										</td>
										<td className="px-4 py-3 text-right">
											<Link
												href={`/course/${encodeURIComponent(course.courseCode)}`}
												aria-label={t("viewDetails", { course: course.courseCode })}
												title={t("viewDetails", { course: course.courseCode })}
												className="inline-flex items-center justify-center rounded-md p-1.5 text-text-secondary transition-colors hover:bg-overlay hover:text-accent-blue"
											>
												<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
													<path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
													<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
												</svg>
											</Link>
										</td>
									</tr>
								))
							)}
						</tbody>
						{!loading && rows.length > 0 && (
							<tfoot>
								<tr className="border-t border-border bg-[var(--calendar-header-bg)]">
									<td className="px-4 py-3 font-medium text-text-secondary" colSpan={2}>
										{t("totalRow", { count: rows.length })}
									</td>
									<td className="px-4 py-3 text-right font-semibold tabular-nums font-mono text-foreground">
										{(rows.reduce((sum, c) => sum + (c.totalAttendedMinutes ?? 0), 0) / 60).toFixed(1)}
										<span className="ml-1 text-text-tertiary">h</span>
									</td>
									<td aria-hidden />
								</tr>
							</tfoot>
						)}
					</table>
				</div>
			</main>
		</div>
	);
}
