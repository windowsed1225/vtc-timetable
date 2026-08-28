"use client";

import { HybridAttendanceStats } from "@/app/actions";
import { LINE_COLORS } from "@/lib/colors";
import { DEFAULT_GRACE_PERIOD_THRESHOLD, thresholdOf } from "@/lib/grace-period";
import { CalendarEvent } from "@/types/timetable";
import { useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";
import AttendanceModal from "./AttendanceModal";
import CourseDetailsModal from "./CourseDetailsModal";
import SemesterSummaryCard from "./SemesterSummaryCard";

// Semester display names — resolved at runtime via translations
const SEMESTER_KEY_MAP: Record<string, "sem1Label" | "sem2Label" | "sem3Label"> = {
	"SEM 1": "sem1Label",
	"SEM 2": "sem2Label",
	"SEM 3": "sem3Label",
};

// Semester sort order (newest first)
const SEMESTER_ORDER: Record<string, number> = {
	"SEM 3": 3,
	"SEM 2": 2,
	"SEM 1": 1,
};

interface CourseInfo {
	courseCode: string;
	courseTitle: string;
	colorIndex: number;
	semester: string;
	status: string;
}

interface SidebarProps {
	courses: CourseInfo[];
	events: CalendarEvent[];
	attendance: HybridAttendanceStats[];
	onSyncClick: () => void;
	onRefreshAttendance: () => void;
	onRefreshCalendar: () => void;
	isSyncing: boolean;
	isRefreshingAttendance: boolean;
	isRefreshingCalendar: boolean;
	vtcUrl: string;
	user?: {
		name?: string | null;
		image?: string | null;
	} | null;
	sidebarOpen?: boolean;
	onStartTour?: () => void;
}

export default function Sidebar({ courses, events, attendance, onSyncClick, onRefreshAttendance, onRefreshCalendar, isSyncing, isRefreshingAttendance, isRefreshingCalendar, user, sidebarOpen, onStartTour }: SidebarProps) {
	const t = useTranslations("calendar");
	const tAtt = useTranslations("attendance");
	const tTour = useTranslations("tour");
	const semLabel = (sem: string) => t(SEMESTER_KEY_MAP[sem] ?? "sem1Label");
	const [selectedCourse, setSelectedCourse] = useState<HybridAttendanceStats | null>(null);
	const [selectedCourseInfo, setSelectedCourseInfo] = useState<CourseInfo | null>(null);
	const [calculatingCourse, setCalculatingCourse] = useState<HybridAttendanceStats | null>(null);

	// Global Attendance Stats (Current Semester only) - Using class counts
	const globalStats = useMemo(() => {
		let totalAttended = 0;
		let totalConducted = 0;
		let totalClasses = 0;
		let totalRemaining = 0;
		let hasActive = false;

		attendance.forEach((course) => {
			// Skip follow-up courses (ending with 'A')
			if (/A$/.test(course.courseCode)) {
				return;
			}

			if (course.status === "ACTIVE") {
				totalAttended += course.attended || 0;
				totalConducted += course.calendarConductedClasses || 0;
				totalClasses += course.calendarTotalClasses || 0;
				totalRemaining += course.calendarRemainingClasses || 0;
				hasActive = true;
			}
		});

		// Calculate rates
		const currentRate = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 100;
		const maxPossibleRate = totalClasses > 0 ? ((totalAttended + totalRemaining) / totalClasses) * 100 : 100;

		// Color coding
		let colorClass = "text-success";
		let bgClass = "bg-success";
		const passingLine = attendance[0] ? thresholdOf(attendance[0]) : DEFAULT_GRACE_PERIOD_THRESHOLD;
		if (currentRate < passingLine) {
			colorClass = "text-error";
			bgClass = "bg-error";
		} else if (currentRate < 90) {
			colorClass = "text-warning";
			bgClass = "bg-warning";
		}

		return {
			attended: totalAttended,
			conducted: totalConducted,
			total: totalClasses,
			remaining: totalRemaining,
			currentRate: Math.round(currentRate * 10) / 10,
			maxPossibleRate: Math.round(maxPossibleRate * 10) / 10,
			colorClass,
			bgClass,
			hasActive,
		};
	}, [attendance]);

	// Group courses by semester and determine initial expand state
	const groupedCourses = useMemo(() => {
		const groups: Record<string, { courses: CourseInfo[]; hasActive: boolean }> = {};

		for (const course of courses) {
			const sem = course.semester || "SEM 2";
			if (!groups[sem]) {
				groups[sem] = { courses: [], hasActive: false };
			}
			groups[sem].courses.push(course);
			if (course.status === "UPCOMING") {
				groups[sem].hasActive = true;
			}
		}

		// Sort by semester order (newest first)
		return Object.entries(groups).sort(([a], [b]) => (SEMESTER_ORDER[b] || 0) - (SEMESTER_ORDER[a] || 0)) as [string, { courses: CourseInfo[]; hasActive: boolean }][];
	}, [courses]);

	// Group attendance by semester - multi-semester courses appear in each semester they span
	const groupedAttendance = useMemo(() => {
		const groups: Record<string, { items: { item: HybridAttendanceStats; viewSemester: string }[]; hasActive: boolean }> = {};

		for (const item of attendance) {
			// Skip follow-up courses (ending with 'A')
			if (/A$/.test(item.courseCode)) {
				continue;
			}

			const breakdownSems = item.semesterBreakdowns ? Object.keys(item.semesterBreakdowns) : [];
			const displaySem = item.displaySemester || item.semester || "SEM 2";
			// Always include displaySemester (from calendar events) plus any semesters with actual class records
			const sems = Array.from(new Set([displaySem, ...breakdownSems]));

			for (const sem of sems) {
				if (!groups[sem]) groups[sem] = { items: [], hasActive: false };
				groups[sem].items.push({ item, viewSemester: sem });
				if (item.status === "ACTIVE") groups[sem].hasActive = true;
			}
		}

		// Sort by semester order (newest first)
		return Object.entries(groups).sort(([a], [b]) => (SEMESTER_ORDER[b] || 0) - (SEMESTER_ORDER[a] || 0)) as [string, { items: { item: HybridAttendanceStats; viewSemester: string }[]; hasActive: boolean }][];
	}, [attendance]);

	// Group events by semester for summary cards
	const eventsBySemester = useMemo(() => {
		const groups: Record<string, CalendarEvent[]> = {};

		for (const event of events) {
			const sem = event.resource?.semester || "SEM 2";
			if (!groups[sem]) {
				groups[sem] = [];
			}
			groups[sem].push(event);
		}

		return groups;
	}, [events]);

	// Track expanded state for each semester accordion
	const [expandedCalendars, setExpandedCalendars] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		groupedCourses.forEach(([sem, data]: [string, { courses: CourseInfo[]; hasActive: boolean }]) => {
			initial[`cal-${sem}`] = data.hasActive;
		});
		return initial;
	});

	const [expandedAttendance, setExpandedAttendance] = useState<Record<string, boolean>>(() => {
		const initial: Record<string, boolean> = {};
		groupedAttendance.forEach(([sem, data]: [string, { items: { item: HybridAttendanceStats; viewSemester: string }[]; hasActive: boolean }]) => {
			initial[`att-${sem}`] = data.hasActive;
		});
		return initial;
	});

	const toggleCalendar = (sem: string) => {
		setExpandedCalendars((prev: Record<string, boolean>) => ({ ...prev, [`cal-${sem}`]: !prev[`cal-${sem}`] }));
	};

	const toggleAttendance = (sem: string) => {
		setExpandedAttendance((prev: Record<string, boolean>) => ({ ...prev, [`att-${sem}`]: !prev[`att-${sem}`] }));
	};

	// Chevron icon component
	const ChevronIcon = ({ isExpanded }: { isExpanded: boolean }) => (
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
			<path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
		</svg>
	);

	return (
		<>
			<aside className={`glass dashboard-sidebar h-full flex flex-col overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`}>
				{/* Header */}
				<div className="sidebar-heading">
					<h1 className="font-display text-lg font-semibold tracking-tight">{t("calendarHeader")}</h1>
				</div>

				{/* Scrollable content */}
				<div className="sidebar-scroll flex-1 overflow-y-auto space-y-5">
					{/* My Calendars Section */}
					<section>
						<div className="flex items-center justify-between mb-3">
							<h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{t("myCalendars")}</h2>
							<button onClick={onRefreshCalendar} disabled={isRefreshingCalendar} className="p-1 rounded hover:bg-overlay transition-colors disabled:opacity-50" title="Refresh calendar from database">
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 text-[var(--text-tertiary)] ${isRefreshingCalendar ? "animate-spin" : ""}`}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
								</svg>
							</button>
						</div>

						{courses.length === 0 ? (
							<p className="text-sm text-[var(--text-tertiary)]">{t("noCoursesYet")}</p>
						) : (
							<div className="space-y-2">
								{/* Semester Course Lists */}
								{groupedCourses.map(([semester, data]) => {
									const isExpanded = expandedCalendars[`cal-${semester}`] ?? data.hasActive;
									const isFinishedSemester = !data.hasActive;

									return (
										<div key={semester}>
											{/* Semester Header */}
											<button onClick={() => toggleCalendar(semester)} className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg hover:bg-overlay transition-colors ${isFinishedSemester ? "text-[var(--text-tertiary)]" : "text-[var(--foreground)]"}`}>
												<ChevronIcon isExpanded={isExpanded} />
												<span className="text-xs font-medium">{semLabel(semester)}</span>
												<span className="text-xs text-[var(--text-tertiary)] ml-auto">{data.courses.length}</span>
											</button>

											{/* Semester Courses & Summary */}
											{isExpanded && (
												<div className="ml-5 mt-1 space-y-2 animate-fadeIn">
													{/* Semester Summary Card */}
													{(eventsBySemester[semester] || []).length > 0 && <SemesterSummaryCard events={eventsBySemester[semester] || []} semesterLabel={semLabel(semester)} />}
													{/* Course List */}
													{data.courses.map((course) => (
														<button key={`${course.courseCode}-${course.semester}`} onClick={() => setSelectedCourseInfo(course)} className={`w-full flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-overlay hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:shadow-none transition-all cursor-pointer text-left ${course.status === "FINISHED" ? "opacity-60" : ""}`}>
															<div
																className="platform-chip-bullet"
																style={
																	{
																		"--chip-color": LINE_COLORS[course.colorIndex] || LINE_COLORS[0],
																		filter: course.status === "FINISHED" ? "grayscale(50%)" : "none",
																	} as CSSProperties
																}
															/>
															<div className="flex-1 min-w-0">
																<p className="text-sm font-medium truncate">{course.courseCode}</p>
																<p className="text-xs text-[var(--text-tertiary)] truncate">{course.courseTitle}</p>
															</div>
														</button>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}
					</section>

					{/* Attendance Section */}
					{user && (
						<section data-tour="attendance">
							<div className="flex items-center justify-between mb-3">
								<h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{tAtt("attendance")}</h2>
								<button onClick={onRefreshAttendance} disabled={isRefreshingAttendance} className="p-1 rounded hover:bg-overlay transition-colors disabled:opacity-50" title="Refresh attendance from VTC">
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-4 h-4 text-[var(--text-tertiary)] ${isRefreshingAttendance ? "animate-spin" : ""}`}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
									</svg>
								</button>
							</div>

							{attendance.length === 0 ? (
								<p className="text-sm text-[var(--text-tertiary)]">No attendance data. Sync your schedule first.</p>
							) : (
								<div className="space-y-2">
									{/* Total Attendance Summary */}
									{globalStats.hasActive && (
										<div className="w-full py-2 px-3 rounded-lg bg-overlay text-left">

											<div className="flex items-center justify-between mb-1">
												<span className="text-xs font-semibold text-[var(--text-secondary)]">{tAtt("totalAttendance")}</span>
												<span className={`text-sm font-bold ${globalStats.colorClass}`}>{globalStats.currentRate.toFixed(1)}%</span>
											</div>
											<div className="w-full h-1 bg-[var(--calendar-border)] rounded-full overflow-hidden">
												<div className={`h-full rounded-full transition-all duration-500 ${globalStats.bgClass}`} style={{ width: `${Math.min(globalStats.currentRate, 100)}%` }} />
											</div>
											<div className="text-[10px] text-[var(--text-tertiary)] mt-1">Max: {globalStats.maxPossibleRate.toFixed(0)}%</div>
										</div>
									)}

									{groupedAttendance.map(([semester, data]) => {
										const isExpanded = expandedAttendance[`att-${semester}`] ?? data.hasActive;
										const isFinishedSemester = !data.hasActive;

										return (
											<div key={semester}>
												{/* Semester Header */}
												<button onClick={() => toggleAttendance(semester)} className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg hover:bg-overlay transition-colors ${isFinishedSemester ? "text-[var(--text-tertiary)]" : "text-[var(--foreground)]"}`}>
													<ChevronIcon isExpanded={isExpanded} />
													<span className="text-xs font-medium">{semLabel(semester)}</span>
													<span className="text-xs text-[var(--text-tertiary)] ml-auto">{data.items.length}</span>
												</button>

												{/* Semester Attendance */}
												{isExpanded && (
													<div className="ml-5 mt-1 space-y-1 animate-fadeIn">
														{data.items.map(({ item: course, viewSemester }) => {
																		const breakdown = course.semesterBreakdowns?.[viewSemester];
																		const breakdownSemCount = Object.keys(course.semesterBreakdowns || {}).length;
																		// Multi-sem: 2+ breakdown sems, OR displaySemester differs from actual class semesters (e.g. enrolled SEM 3 but all classes in SEM 2)
																		const isMultiSem = breakdownSemCount > 1 || (breakdownSemCount > 0 && course.displaySemester !== undefined && !course.semesterBreakdowns?.[course.displaySemester]);
																		const rate = breakdown ? breakdown.attendanceRate : (isMultiSem ? 0 : (course.minutesAttendanceRate ?? course.currentAttendanceRate ?? 0));
																		const maxRate = course.maxPossibleMinutesRate ?? course.maxPossibleRate ?? 100;
																		const attendedCount = breakdown ? breakdown.attended : 0;
																		const conductedCount = breakdown ? breakdown.conductedClasses : 0;
																		const isFinished = course.status === "FINISHED";
															const totalRate = course.minutesAttendanceRate ?? course.currentAttendanceRate ?? 0;
																const totalMaxRate = course.maxPossibleMinutesRate ?? course.maxPossibleRate ?? 100;
																const passingLine = thresholdOf(course);

																return (
																<div key={`${course.courseCode}-${viewSemester}`}>
																	<button onClick={() => setSelectedCourse(course)} className={`w-full py-2 px-2 rounded-lg hover:bg-overlay hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:shadow-none transition-all text-left ${isFinished ? "opacity-60" : ""}`}>
																		<div className="flex items-center justify-between mb-1">
																			<span className="text-sm font-medium truncate flex-1">{course.courseCode}</span>
																			<div className="flex items-center gap-1">
																				{isMultiSem && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-accent-blue/15 text-accent-blue">{tAtt("mix")}</span>}
																				{/* Recovery Status Badge */}
																				{!isFinished && course.recoveryStatus === "recoverable" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/15 text-warning">{tAtt("recoverable")} ⚠️</span>}
																				{!isFinished && course.recoveryStatus === "failed" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-error/15 text-error">{tAtt("failed")} ❌</span>}
																				{course.isFollowUp && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-line-7/15 text-line-7">{tAtt("followUp")}</span>}
																				{isFinished && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-overlay text-text-tertiary">{tAtt("finished")}</span>}
																			</div>
																			<span className={`text-sm font-semibold ml-2 ${course.recoveryStatus === "grace" ? "text-warning" : rate < passingLine ? "text-error" : rate < 90 ? "text-warning" : "text-success"}`}>
																				{rate.toFixed(1)}%
																			</span>
																		</div>
																		<div className="w-full h-1.5 bg-[var(--calendar-border)] rounded-full overflow-hidden mb-1.5">
																			<div
																				className={`h-full rounded-full transition-all duration-500 ${rate < passingLine ? "bg-error" : rate < 90 ? "bg-warning" : "bg-success"}`}
																				style={{ width: `${Math.min(rate, 100)}%`, filter: isFinished ? "grayscale(50%)" : "none" }}
																			/>
																		</div>
																		<div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
																			<span>{attendedCount} / {breakdown ? breakdown.calendarTotalClasses : 0} classes</span>
																			{!isMultiSem && <span className="text-text-tertiary">Max: {maxRate.toFixed(0)}%</span>}
																		</div>
																	</button>
																	{/* Total button for multi-semester courses */}
																	{isMultiSem && (
																		<button
																			onClick={() => setSelectedCourse(course)}
																			className="w-full mt-0.5 py-1 px-2 rounded-md flex items-center justify-between text-[10px] bg-overlay hover:bg-active transition-colors text-[var(--text-tertiary)]"
																		>
																			<span className="font-medium">{tAtt("totalLabel")}</span>
																			<span className={`font-semibold ${totalRate < passingLine ? "text-error" : totalRate < 90 ? "text-warning" : "text-success"}`}>
																				{totalRate.toFixed(1)}% &nbsp;Â·&nbsp; Max {totalMaxRate.toFixed(0)}%
																			</span>
																		</button>
																	)}
																</div>
															);
														})}
													</div>
												)}
											</div>
										);
									})}
								</div>
							)}
						</section>
					)}
				</div>

				{/* Footer Actions */}
				<div className="sidebar-footer border-t border-[var(--sidebar-border)] space-y-2">
					{/* Sync button — only available once signed in */}
					{user && (
						<button data-tour="sync-button" onClick={onSyncClick} disabled={isSyncing} className={`btn-primary w-full flex items-center justify-center gap-2 ${isSyncing ? "btn-syncing" : ""}`}>
							{isSyncing ? (
								<>
									<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
									</svg>
									Syncing...
								</>
							) : (
								<>
									<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
										<path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
									</svg>
									Sync Schedule
								</>
							)}
						</button>
					)}

					{/* Help / replay the product tour */}
					{onStartTour && (
						<button
							onClick={onStartTour}
							className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:bg-overlay hover:text-[var(--foreground)] transition-colors"
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
							</svg>
							{tTour("helpButton")}
						</button>
					)}
				</div>
			</aside>

			{/* Attendance Detail Modal */}
			{selectedCourse && <AttendanceModal course={selectedCourse} onClose={() => setSelectedCourse(null)} />}

			{/* Course Details Modal */}
			{selectedCourseInfo && <CourseDetailsModal courseCode={selectedCourseInfo.courseCode} courseTitle={selectedCourseInfo.courseTitle} colorIndex={selectedCourseInfo.colorIndex} events={events} attendance={attendance.find((a) => a.courseCode === selectedCourseInfo.courseCode || a.baseCourseCode === selectedCourseInfo.courseCode || selectedCourseInfo.courseCode.startsWith(a.courseCode) || a.courseCode.startsWith(selectedCourseInfo.courseCode)) || null} onClose={() => setSelectedCourseInfo(null)} />}
		</>
	);
}

