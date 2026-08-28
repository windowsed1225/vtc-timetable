"use client";

import type { HybridAttendanceStats } from "@/app/actions";
import { thresholdOf } from "@/lib/grace-period";
import { Link } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import AttendanceModal from "./AttendanceModal";

interface MobileAttendanceViewProps {
	attendance: HybridAttendanceStats[];
	onRefresh: () => void;
	isRefreshing: boolean;
}

const semesterOrder: Record<string, number> = { "SEM 3": 3, "SEM 2": 2, "SEM 1": 1 };
const semesterKeys: Record<string, "sem1Label" | "sem2Label" | "sem3Label"> = { "SEM 1": "sem1Label", "SEM 2": "sem2Label", "SEM 3": "sem3Label" };

export default function MobileAttendanceView({ attendance, onRefresh, isRefreshing }: MobileAttendanceViewProps) {
	const t = useTranslations("attendance");
	const tc = useTranslations("calendar");
	const tGrid = useTranslations("attendanceGrid");
	const [selected, setSelected] = useState<HybridAttendanceStats | null>(null);

	const visibleAttendance = useMemo(() => attendance.filter((item) => !/A$/.test(item.courseCode)), [attendance]);
	const total = useMemo(() => {
		const minutes = visibleAttendance.reduce((sum, item) => sum + (item.totalAttendedMinutes || 0), 0);
		const conducted = visibleAttendance.reduce((sum, item) => sum + (item.totalConductedMinutes || 0), 0);
		return conducted > 0 ? (minutes / conducted) * 100 : 0;
	}, [visibleAttendance]);
	const grouped = useMemo(() => {
		const groups: Record<string, HybridAttendanceStats[]> = {};
		for (const item of visibleAttendance) {
			const semester = item.displaySemester || item.semester || "SEM 2";
			(groups[semester] ||= []).push(item);
		}
		return Object.entries(groups).sort(([a], [b]) => (semesterOrder[b] || 0) - (semesterOrder[a] || 0));
	}, [visibleAttendance]);

	return (
		<section className="mobile-attendance-view" aria-labelledby="mobile-attendance-title">
			<header className="mobile-attendance-header">
				<div><p>{t("attendance")}</p><h1 id="mobile-attendance-title">{t("totalAttendance")}</h1></div>
				<button type="button" className="btn-icon" onClick={onRefresh} disabled={isRefreshing} aria-label={t("refreshAttendance")}>
					<svg className={isRefreshing ? "animate-spin" : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 6v5h-5M4 18v-5h5m9.5-3A7 7 0 0 0 6.2 6.2L4 8m16 8-2.2 1.8A7 7 0 0 1 5.5 14" /></svg>
				</button>
			</header>

			<div className="mobile-attendance-total">
				<strong>{total.toFixed(1)}%</strong>
				<div><span style={{ width: `${Math.min(100, total)}%` }} /></div>
			</div>

			<Link href="/attendance-grid" className="mobile-attendance-grid-link">
				<span>{tGrid("navLabel")}</span><span aria-hidden="true">→</span>
			</Link>

			{grouped.length === 0 ? <p className="mobile-attendance-empty">{t("noAttendanceData")}</p> : grouped.map(([semester, items]) => (
				<section key={semester} className="mobile-attendance-semester">
					<div className="mobile-attendance-semester-heading"><h2>{tc(semesterKeys[semester] || "sem2Label")}</h2><span>{items.length}</span></div>
					<div className="mobile-attendance-courses">
						{items.map((course) => {
							const rate = course.minutesAttendanceRate ?? course.attendRate ?? 0;
							return (
								<button type="button" key={`${semester}-${course.courseCode}`} onClick={() => setSelected(course)} className="mobile-attendance-course">
									<div><strong>{course.courseCode}</strong><small>{course.courseName}</small></div>
									<span className={rate < thresholdOf(course) ? "is-low" : ""}>{rate.toFixed(1)}%</span>
									<div className="mobile-attendance-progress"><span style={{ width: `${Math.min(100, rate)}%` }} /></div>
									<small>{course.conductedClasses} / {course.totalClasses} {t("classes")} · {t("maxPossible")}: {(course.maxPossibleMinutesRate ?? rate).toFixed(0)}%</small>
								</button>
							);
						})}
					</div>
				</section>
			))}

			<AttendanceModal course={selected} onClose={() => setSelected(null)} />
		</section>
	);
}
