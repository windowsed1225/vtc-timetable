"use client";

import { getHybridAttendanceStats, HybridAttendanceStats } from "@/app/actions";
import { useSession } from "@/lib/auth-client";
import { courseHref } from "@/lib/course-route";
import { Link } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

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
	const [query, setQuery] = useState("");

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

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((course) =>
			`${course.courseCode} ${course.courseName ?? ""}`.toLowerCase().includes(needle),
		);
	}, [rows, query]);

	const totalHours = useMemo(
		() => (filtered.reduce((sum, c) => sum + (c.totalAttendedMinutes ?? 0), 0) / 60).toFixed(1),
		[filtered],
	);

	return (
		<div className="attendance-grid-page">
			<main className="attendance-grid-main">
				{/* Page header */}
				<div className="attendance-grid-header">
					<div className="min-w-0">
						<Link href="/" className="attendance-grid-back">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
								<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
							</svg>
							{t("back")}
						</Link>
						<p className="attendance-grid-eyebrow">{t("eyebrow")}</p>
						<h1>{t("title")}</h1>
						<p className="attendance-grid-lede">{t("description")}</p>
					</div>

					<div className="attendance-grid-search">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
						</svg>
						<input
							type="search"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							aria-label={t("searchLabel")}
							placeholder={t("searchPlaceholder")}
							className="input-field"
						/>
					</div>
				</div>

				{/* Grid */}
				<div className="attendance-grid-card">
					<table>
						<thead>
							<tr>
								<th>{t("colStudent")}</th>
								<th>{t("colCourse")}</th>
								<th className="is-numeric">{t("colHours")}</th>
								<th className="is-action"><span className="sr-only">{t("colView")}</span></th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={4} className="attendance-grid-state">
										<div className="flex items-center justify-center gap-3 text-text-secondary">
											<span className="attendance-grid-spinner" />
											<span className="text-sm">{t("loading")}</span>
										</div>
									</td>
								</tr>
							) : rows.length === 0 ? (
								<tr>
									<td colSpan={4} className="attendance-grid-state">
										<div className="flex flex-col items-center justify-center gap-2 text-center">
											<span className="attendance-grid-empty-mark">
												<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
													<path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h16.5v16.5H3.75zM3.75 9h16.5M3.75 14.25h16.5M9 3.75v16.5M15 3.75v16.5" />
												</svg>
											</span>
											<p className="text-sm font-bold text-foreground">{t("emptyTitle")}</p>
											<p className="max-w-sm text-xs text-text-tertiary">{t("emptyDescription")}</p>
										</div>
									</td>
								</tr>
							) : filtered.length === 0 ? (
								<tr>
									<td colSpan={4} className="attendance-grid-state">
										<p className="text-center text-sm text-text-tertiary">{t("noMatches")}</p>
									</td>
								</tr>
							) : (
								filtered.map((course) => (
									<tr key={`${course.courseCode}-${course.semester}`}>
										<td>{studentName}</td>
										<td>
											<span className="attendance-grid-code">{course.courseCode}</span>
											{course.courseName && course.courseName !== course.courseCode && (
												<span className="attendance-grid-name">{course.courseName}</span>
											)}
										</td>
										<td className="is-numeric">
											{hoursAttended(course)}
											<small>h</small>
										</td>
										<td className="is-action">
											<Link
												href={courseHref(course.courseCode)}
												aria-label={t("viewDetails", { course: course.courseCode })}
												title={t("viewDetails", { course: course.courseCode })}
												className="attendance-grid-view"
											>
												<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor" aria-hidden="true">
													<path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
													<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
												</svg>
											</Link>
										</td>
									</tr>
								))
							)}
						</tbody>
						{!loading && filtered.length > 0 && (
							<tfoot>
								<tr>
									<td colSpan={2}>{t("totalRow", { count: filtered.length })}</td>
									<td className="is-numeric">
										{totalHours}
										<small>h</small>
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
