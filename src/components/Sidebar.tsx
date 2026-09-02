"use client";

import { HybridAttendanceStats } from "@/app/actions";
import { LINE_COLORS } from "@/lib/colors";
import { Link, usePathname } from "@/lib/navigation";
import { SEMESTER_ORDER, semesterI18nKey } from "@/lib/semester";
import { CalendarEvent } from "@/types/timetable";
import { BookOpen, ChevronRight, ClipboardCheck, Code2, CreditCard, HelpCircle, LayoutGrid, Loader2, RefreshCw, Settings, Table2 } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState, type CSSProperties } from "react";
import CourseDetailsModal from "./CourseDetailsModal";
import SemesterSummaryCard from "./SemesterSummaryCard";

// Persistent sidebar navigation. lucide-react, one family, size-5 in the rail.
// `en` doubles as the reference's secondary English label; it is suppressed when
// the UI is already in English so the row does not read the same word twice.
const NAV_ITEMS = [
	{ href: "/", key: "home", en: "Home", Icon: LayoutGrid },
	{ href: "/attendance", key: "attendance", en: "Attendance", Icon: ClipboardCheck },
	{ href: "/attendance-grid", key: "attendanceGrid", en: "Attendance hours", Icon: Table2 },
	{ href: "/dashboard#moodle", key: "moodle", en: "Moodle", Icon: BookOpen },
	{ href: "/student-card", key: "studentCard", en: "Student card", Icon: CreditCard },
	{ href: "/api", key: "api", en: "API", Icon: Code2 },
] as const;

const SETTINGS_ITEM = { href: "/settings", key: "settings", en: "Settings", Icon: Settings } as const;

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
	onRefreshCalendar: () => void;
	isSyncing: boolean;
	isRefreshingCalendar: boolean;
	vtcUrl: string;
	user?: {
		name?: string | null;
		image?: string | null;
	} | null;
	sidebarOpen?: boolean;
	onStartTour?: () => void;
}

export default function Sidebar({ courses, events, attendance, onSyncClick, onRefreshCalendar, isSyncing, isRefreshingCalendar, user, sidebarOpen, onStartTour }: SidebarProps) {
	const t = useTranslations("calendar");
	const tTour = useTranslations("tour");
	const tNav = useTranslations("nav");
	const pathname = usePathname();
	const semLabel = (sem: string) => t(semesterI18nKey(sem));
	const [selectedCourseInfo, setSelectedCourseInfo] = useState<CourseInfo | null>(null);

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

	const toggleCalendar = (sem: string) => {
		setExpandedCalendars((prev: Record<string, boolean>) => ({ ...prev, [`cal-${sem}`]: !prev[`cal-${sem}`] }));
	};

	// One nav row: icon, localized label, and the reference's trailing English gloss.
	const renderNavLink = (item: { href: string; key: string; en: string; Icon: typeof LayoutGrid }) => {
		const isActive = pathname === item.href;
		const label = tNav(item.key);
		const { Icon } = item;
		return (
			<Link
				key={item.href}
				href={item.href}
				className={`sidebar-nav-link ${isActive ? "is-active" : ""}`}
				aria-current={isActive ? "page" : undefined}
			>
				<Icon aria-hidden="true" />
				<span className="sidebar-nav-label">
					{label}
					{label === item.en ? null : <span aria-hidden="true">{item.en}</span>}
				</span>
			</Link>
		);
	};

	// Chevron icon component
	const ChevronIcon = ({ isExpanded }: { isExpanded: boolean }) => (
		<ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden="true" />
	);

	return (
		<>
			<aside className={`glass dashboard-sidebar h-full flex flex-col overflow-hidden ${sidebarOpen ? "sidebar-open" : ""}`}>
				{/* Brand — the desktop shell's only logo lockup. */}
				<div className="sidebar-heading">
					<Link href="/" className="sidebar-brand">
						<Image src="/vtc-timetable.svg" alt="" width={44} height={44} aria-hidden="true" />
						<span className="min-w-0">
							<span className="sidebar-brand-title">VTC Timetable</span>
							<span className="sidebar-brand-subtitle">{t("calendarHeader")}</span>
						</span>
					</Link>
				</div>

				{/* Primary navigation — persistent across every route. */}
				<nav className="sidebar-nav" aria-label={tNav("label")}>
					{NAV_ITEMS.map((item) => renderNavLink(item))}
				</nav>

				{/* Scrollable content */}
				<div className="sidebar-scroll flex-1 overflow-y-auto space-y-5">
					{/* My Calendars Section */}
					<section>
						<div className="flex items-center justify-between mb-3">
							<h2 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{t("myCalendars")}</h2>
							<button onClick={onRefreshCalendar} disabled={isRefreshingCalendar} className="p-1 rounded hover:bg-overlay transition-colors disabled:opacity-50" title="Refresh calendar from database">
								<RefreshCw className={`w-4 h-4 text-[var(--text-tertiary)] ${isRefreshingCalendar ? "animate-spin" : ""}`} aria-hidden="true" />
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
				</div>

				{/* Footer Actions */}
				<div className="sidebar-footer border-t border-[var(--sidebar-border)] space-y-2">
					{/* Settings sits at the foot of the rail, as in the campus reference. */}
					{renderNavLink(SETTINGS_ITEM)}

					{/* Sync button — only available once signed in */}
					{user && (
						<button data-tour="sync-button" onClick={onSyncClick} disabled={isSyncing} className={`btn-primary w-full flex items-center justify-center gap-2 ${isSyncing ? "btn-syncing" : ""}`}>
							{isSyncing ? (
								<>
									<Loader2 className="animate-spin h-4 w-4" aria-hidden="true" />
									Syncing...
								</>
							) : (
								<>
									<RefreshCw className="w-4 h-4" aria-hidden="true" />
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
							<HelpCircle className="w-4 h-4" aria-hidden="true" />
							{tTour("helpButton")}
						</button>
					)}
				</div>
			</aside>


			{/* Course Details Modal */}
			{selectedCourseInfo && <CourseDetailsModal courseCode={selectedCourseInfo.courseCode} courseTitle={selectedCourseInfo.courseTitle} colorIndex={selectedCourseInfo.colorIndex} events={events} attendance={attendance.find((a) => a.courseCode === selectedCourseInfo.courseCode || a.baseCourseCode === selectedCourseInfo.courseCode || selectedCourseInfo.courseCode.startsWith(a.courseCode) || a.courseCode.startsWith(selectedCourseInfo.courseCode)) || null} onClose={() => setSelectedCourseInfo(null)} />}
		</>
	);
}

