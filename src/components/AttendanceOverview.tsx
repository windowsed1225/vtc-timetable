"use client";

import { getHybridAttendanceStats, refreshAttendance, type HybridAttendanceStats } from "@/app/actions";
import AttendanceModal from "@/components/AttendanceModal";
import { buildAttendanceOverview } from "@/lib/attendance-overview";
import { courseHref } from "@/lib/course-route";
import { Link } from "@/lib/navigation";
import { semesterI18nKey } from "@/lib/semester";
import { ChevronDown, ClipboardPen, RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

interface AttendanceOverviewProps {
	/** Lets the shell reuse the stats this page already loaded. */
	onStatsLoaded?: (stats: HybridAttendanceStats[]) => void;
}

/**
 * Full attendance page: overall summary, semester picker and one card per
 * course. Every figure comes from getHybridAttendanceStats, the same source the
 * sidebar used before, so the numbers and the configured threshold are unchanged.
 */
export default function AttendanceOverview({ onStatsLoaded }: AttendanceOverviewProps) {
	const t = useTranslations("attendancePage");
	const tAtt = useTranslations("attendance");
	const tCal = useTranslations("calendar");
	const tCourse = useTranslations("courseDetail");

	const [stats, setStats] = useState<HybridAttendanceStats[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [entryOpen, setEntryOpen] = useState(false);
	const [entryCourse, setEntryCourse] = useState<HybridAttendanceStats | null>(null);
	const [coursesOpen, setCoursesOpen] = useState(true);
	// Kept in the URL so browser Back from a course returns to the same semester.
	const [semester, setSemester] = useState<string | null>(() => {
		if (typeof window === "undefined") return null;
		return new URLSearchParams(window.location.search).get("sem");
	});

	const selectSemester = (next: string) => {
		setSemester(next);
		if (typeof window === "undefined") return;
		const url = new URL(window.location.href);
		url.searchParams.set("sem", next);
		window.history.replaceState(null, "", url.pathname + url.search);
	};

	const load = useCallback(async () => {
		const result = await getHybridAttendanceStats();
		if (!result.success || !result.data) {
			setError(result.error || t("loadFailed"));
			return;
		}
		setError(null);
		setStats(result.data);
		onStatsLoaded?.(result.data);
	}, [onStatsLoaded, t]);

	useEffect(() => {
		let active = true;
		getHybridAttendanceStats()
			.then((result) => {
				if (!active) return;
				if (result.success && result.data) {
					setStats(result.data);
					onStatsLoaded?.(result.data);
				} else {
					setError(result.error || t("loadFailed"));
				}
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
		// Runs once on mount; refreshes go through handleRefresh.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Pull fresh attendance from VTC, then re-read the merged stats.
	const handleRefresh = async () => {
		setIsRefreshing(true);
		try {
			const result = await refreshAttendance();
			if (!result.success) {
				setError(result.error || t("refreshFailed"));
				return;
			}
			await load();
		} catch {
			setError(t("refreshFailed"));
		} finally {
			setIsRefreshing(false);
		}
	};

	const { semesters, activeSemester, rows, summary } = useMemo(
		() => buildAttendanceOverview(stats, semester),
		[semester, stats],
	);

	const semesterLabel = (sem: string) => tCal(semesterI18nKey(sem));
	const percent = (value: number | null) => (value === null ? t("noData") : `${value.toFixed(1)}%`);

	return (
		<div className="attendance-page">
			<div className="attendance-page-heading">
				<div className="min-w-0">
					<p className="campus-breadcrumb">{t("breadcrumb")}</p>
					<h1>{t("title")}</h1>
					<p>{t("subtitle")}</p>
				</div>
				<div className="attendance-page-actions">
					<button
						type="button"
						className="campus-icon-button"
						onClick={handleRefresh}
						disabled={isRefreshing}
						aria-label={tAtt("refreshAttendance")}
					>
						<RefreshCw className={isRefreshing ? "animate-spin" : ""} aria-hidden="true" />
					</button>
					<button
						type="button"
						className="attendance-entry-button"
						aria-haspopup="dialog"
						onClick={() => {
							// Open manual entry on the first visible course; the modal
							// still lets the user switch semester tabs inside a course.
							setEntryCourse(rows[0]?.course ?? stats[0] ?? null);
							setEntryOpen(true);
						}}
					>
						<ClipboardPen aria-hidden="true" />
						{t("entry")}
					</button>
				</div>
			</div>

			{error && (
				<p className="attendance-error" role="alert">
					<TriangleAlert aria-hidden="true" />
					{error}
				</p>
			)}

			{loading ? (
				<div className="attendance-skeletons" aria-hidden="true">
					<div className="attendance-skeleton attendance-skeleton-total" />
					<div className="attendance-skeleton attendance-skeleton-row" />
					<div className="attendance-card-grid">
						{[0, 1, 2].map((index) => (
							<div key={index} className="attendance-skeleton attendance-skeleton-card" />
						))}
					</div>
				</div>
			) : rows.length === 0 ? (
				<section className="attendance-empty">
					<h2>{tAtt("noAttendanceData")}</h2>
					<p>{t("emptyHint")}</p>
					<Link href="/" className="btn-primary">
						{t("emptyAction")}
					</Link>
				</section>
			) : (
				<>
					{/* Overall summary for the selected semester. */}
					<section className="attendance-total" aria-label={tAtt("totalAttendance")}>
						<div className="attendance-total-main">
							<div>
								<p className="attendance-total-label">
									{tAtt("totalAttendance")} · {activeSemester ? semesterLabel(activeSemester) : ""}
								</p>
								<div className="attendance-total-figure">
									<strong data-tone={summary.tone}>{percent(summary.rate)}</strong>
									<span>
										{tAtt("maxPossibleShort")}: {percent(summary.maxRate)}
									</span>
								</div>
							</div>

							<div className="attendance-total-stats">
								<div>
									<p>{summary.attended}</p>
									<span>{tAtt("attendedClasses")}</span>
								</div>
								<div data-tone="error">
									<p>{summary.absent}</p>
									<span>{tAtt("absent")}</span>
								</div>
								<div>
									<p>{summary.total}</p>
									<span>{t("totalClasses")}</span>
								</div>
							</div>
						</div>

						<div className="attendance-total-bar">
							<span
								data-tone={summary.tone}
								style={{ width: `${Math.min(Math.max(summary.rate ?? 0, 0), 100)}%` }}
							/>
						</div>
					</section>

					{/* Semester picker. */}
					<section className="attendance-semester-row">
						<div className="attendance-semester-id">
							<span className="attendance-semester-mark" aria-hidden="true">
								<ChevronDown />
							</span>
							<div>
								<p>{t("currentSemester")}</p>
								<strong>{activeSemester ? semesterLabel(activeSemester) : ""}</strong>
							</div>
						</div>

						<div className="attendance-semester-meta">
							<span>
								{t("courseCount", { count: rows.length })} · {t("hoursCount", { hours: summary.hours.toFixed(1) })}
							</span>
							<select
								aria-label={t("selectSemester")}
								value={activeSemester ?? ""}
								onChange={(event) => selectSemester(event.target.value)}
							>
								{semesters.map((sem) => (
									<option key={sem} value={sem}>
										{semesterLabel(sem)}
									</option>
								))}
							</select>
						</div>
					</section>

					<button
						type="button"
						className="attendance-section-heading"
						aria-expanded={coursesOpen}
						aria-controls="attendance-course-grid"
						onClick={() => setCoursesOpen((open) => !open)}
					>
						<h2>{t("courseAttendance")}</h2>
						<span>{t("courseCount", { count: rows.length })}</span>
						<ChevronDown className="attendance-section-chevron" aria-hidden="true" />
					</button>

					<div id="attendance-course-grid" className="attendance-card-grid" hidden={!coursesOpen}>
						{rows.map((row) => (
							<Link
								key={row.course.courseCode}
								href={courseHref(row.course.courseCode)}
								className="attendance-course-card"
								data-tone={row.tone}
								aria-label={tCourse("viewCourse", {
									code: row.course.courseCode,
									name: row.course.courseName || "",
								})}
							>
								<div className="attendance-course-head">
									<div className="min-w-0">
										<p className="attendance-course-code">{row.course.courseCode}</p>
										<h3>{row.course.courseName || row.course.courseCode}</h3>
									</div>
									{row.tone === "error" && <TriangleAlert aria-hidden="true" />}
								</div>

								<div className="attendance-course-figure">
									<strong data-tone={row.tone}>{percent(row.rate)}</strong>
									<span>{t("classesCount", { attended: row.attended, total: row.total })}</span>
								</div>

								<div className="attendance-course-bar">
									<span
										data-tone={row.tone}
										style={{ width: `${Math.min(Math.max(row.rate ?? 0, 0), 100)}%` }}
									/>
								</div>

								<div className="attendance-course-foot">
									<span>{t("absencesCount", { count: row.absences })}</span>
									<span>
										{tAtt("maxPossibleShort")} {percent(row.maxRate)}
									</span>
								</div>
							</Link>
						))}
					</div>
				</>
			)}

			{/* Manual attendance entry — same modal the mobile sheet uses. */}
			{entryOpen && (
				<AttendanceModal
					course={entryCourse}
					onClose={() => {
						setEntryOpen(false);
						setEntryCourse(null);
					}}
				/>
			)}
		</div>
	);
}
