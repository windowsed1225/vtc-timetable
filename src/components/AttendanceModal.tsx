"use client";

import { HybridAttendanceStats } from "@/app/actions";
import { getManualAttendanceMark, saveManualAttendanceMark } from "@/lib/manual-attendance";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const SEM_ORDER: Record<string, number> = { "SEM 1": 1, "SEM 2": 2, "SEM 3": 3 };
const SEM_KEY_MAP: Record<string, "sem1Label" | "sem2Label" | "sem3Label"> = { "SEM 1": "sem1Label", "SEM 2": "sem2Label", "SEM 3": "sem3Label" };

function getClassSemLabel(dateStr: string): string {
	const parts = dateStr.split("/");
	const month = parseInt(parts[1], 10);
	if (month >= 9 && month <= 12) return "SEM 1";
	if (month >= 1 && month <= 4) return "SEM 2";
	return "SEM 3";
}

interface AttendanceModalProps {
	course: HybridAttendanceStats | null;
	onClose: () => void;
}

export default function AttendanceModal({ course, onClose }: AttendanceModalProps) {
	const t = useTranslations("attendance");
	const tCal = useTranslations("calendar");

	const [manualMarks, setManualMarks] = useState<Record<string, "attended" | "late" | "absent">>({});
	const [selectedSem, setSelectedSem] = useState<string | null>(null);

	// Load manual marks on mount and when course changes
	useEffect(() => {
		if (!course) return;

		const marks: Record<string, "attended" | "late" | "absent"> = {};
		course.classes.forEach((cls) => {
			if (cls.attendTime === "MANUAL") {
				const mark = getManualAttendanceMark(course.courseCode, cls.id);
				if (mark) marks[cls.id] = mark;
				else marks[cls.id] = cls.status;
			}
		});
		setManualMarks(marks);
		// Reset semester tab when course changes
		const breakdownSems = Object.keys(course.semesterBreakdowns || {}).sort((a, b) => (SEM_ORDER[a] || 99) - (SEM_ORDER[b] || 99));
		setSelectedSem(breakdownSems.length > 0 ? breakdownSems[breakdownSems.length - 1] : null);
	}, [course]);

	// Handle manual attendance mark
	const handleManualMark = (classId: string, status: "attended" | "late" | "absent") => {
		if (!course) return;

		saveManualAttendanceMark(course.courseCode, classId, status);
		setManualMarks((prev) => ({ ...prev, [classId]: status }));
	};

	if (!course) return null;

	// Semester tabs — use semesterBreakdowns keys if available, else derive from class dates
	const breakdownSemKeys = Object.keys(course.semesterBreakdowns || {}).sort((a, b) => (SEM_ORDER[a] || 99) - (SEM_ORDER[b] || 99));
	const hasBreakdowns = breakdownSemKeys.length > 0;
	const activeSem = selectedSem ?? (hasBreakdowns ? breakdownSemKeys[breakdownSemKeys.length - 1] : null);

	const classesBySemester = (course.classes || []).reduce<Record<string, typeof course.classes>>((acc, cls) => {
		const sem = getClassSemLabel(cls.date);
		if (!acc[sem]) acc[sem] = [];
		acc[sem].push(cls);
		return acc;
	}, {});
	const visibleClasses = activeSem ? (classesBySemester[activeSem] || []) : (course.classes || []);

	const rate = course.minutesAttendanceRate ?? course.attendRate ?? 0;
	const attended = course.attended ?? 0;
	const late = course.late ?? 0;
	const onTime = attended - late;

	return (
		<div className="attendance-modal-shell fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-[rgba(2,8,16,0.65)] backdrop-blur-sm" />

			{/* Modal */}
			<div className="attendance-modal-panel relative bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-scaleIn" onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between p-4 border-b border-[var(--sidebar-border)]">
					<div className="flex-1 min-w-0">
						<h2 className="font-display text-lg font-semibold truncate">{course.courseCode}</h2>
						<p className="text-sm text-text-tertiary truncate">{course.courseName}</p>
					</div>
					<div className="flex items-center gap-2 ml-3">
						{course.isFollowUp && <span className="badge badge-warning">{t("followUp")}</span>}
						{course.isFinished && <span className="badge badge-blue">{t("finished")}</span>}
						<span className={`text-lg font-bold font-mono ${course.isLow ? "text-error" : "text-success"}`}>{rate.toFixed(1)}%</span>
					</div>
					<button onClick={onClose} className="ml-3 p-1 rounded-full hover:bg-overlay transition-colors">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{/* Stats Bar - Detailed Breakdown */}
				<div className="px-4 py-3 bg-overlay border-b border-[var(--sidebar-border)]">
					{/* Detailed Stats Row */}
					<div className="flex items-center justify-between text-xs mb-2 flex-wrap gap-x-3 gap-y-1">
						<div className="flex items-center gap-1 text-success">
							<span>✓</span>
							<span className="font-medium">{(course.attended || 0) - (course.late || 0)} {t("onTime")}</span>
						</div>
						<div className="flex items-center gap-1 text-warning">
							<span>🕐</span>
							<span className="font-medium">{course.late || 0} {t("late")}</span>
						</div>
						<div className="flex items-center gap-1 text-error">
							<span>✗</span>
							<span className="font-medium">{course.absent || 0} {t("absent")}</span>
						</div>
						<div className="flex items-center gap-1 text-text-tertiary ml-auto">
							<span className="font-medium">
								{course.calendarConductedClasses || 0}/{course.calendarTotalClasses || 0} {t("conducted")}
							</span>
							<span>({course.calendarRemainingClasses || 0} {t("remaining")})</span>
						</div>
					</div>

					{/* Centered Percentage Display */}
					<div className="flex justify-center mb-2">
						<span className={`text-2xl font-bold font-mono ${(course.minutesAttendanceRate ?? course.currentAttendanceRate) < 80 ? "text-error" : "text-success"}`}>{(course.minutesAttendanceRate ?? course.currentAttendanceRate).toFixed(1)}%</span>
					</div>

					{/* Progress Bar */}
					<div className="w-full h-2 bg-[var(--calendar-border)] rounded-full overflow-hidden mb-2">
						<div className={`h-full rounded-full transition-all duration-500 ${(course.minutesAttendanceRate ?? course.currentAttendanceRate) < 80 ? "bg-error" : "bg-success"}`} style={{ width: `${Math.min(course.minutesAttendanceRate ?? course.currentAttendanceRate, 100)}%` }} />
					</div>

					{/* Max Possible & Status */}
					<div className="flex items-center justify-between text-xs text-text-tertiary">
						<span>
							{t("maxPossible")}: <span className="font-medium">{(course.maxPossibleMinutesRate ?? course.maxPossibleRate).toFixed(1)}%</span>
						</span>
						{course.recoveryStatus === "safe" && <span className="text-success font-medium">✓ {t("safe")}</span>}
						{course.recoveryStatus === "recoverable" && <span className="text-warning font-medium">⚠️ {t("recoverable")}</span>}
						{course.recoveryStatus === "failed" && <span className="text-error font-medium">❌ {t("failed")}</span>}
					</div>
					{course.currentSemesterStats && course.currentSemesterStats.semester !== course.semester && course.currentSemesterStats.conductedClasses > 0 && (
						<div className="flex items-center justify-between text-xs text-[var(--text-tertiary)] mt-1">
							<span>{course.currentSemesterStats.semester} only:</span>
							<span className="font-medium">{course.currentSemesterStats.attendanceRate}% ({course.currentSemesterStats.attended}/{course.currentSemesterStats.conductedClasses})</span>
						</div>
					)}
				</div>

				{/* Semester Tab Bar */}
				{hasBreakdowns && (
					<div className="flex gap-1 px-4 pt-3 pb-1 border-b border-[var(--sidebar-border)]">
						{breakdownSemKeys.map((sem) => {
							const b = course.semesterBreakdowns![sem];
							const isActive = activeSem === sem;
							return (
								<button
									key={sem}
									onClick={() => setSelectedSem(sem)}
									className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${isActive ? "bg-accent text-white" : "bg-overlay text-[var(--text-secondary)] hover:bg-active"}`}
								>
									<div>{tCal(SEM_KEY_MAP[sem] ?? "sem1Label")}</div>
									<div className={`text-[10px] mt-0.5 ${isActive ? "text-white/80" : "text-[var(--text-tertiary)]"}`}>
										{b.attended}/{b.calendarTotalClasses} · {b.attendanceRate.toFixed(0)}%
									</div>
								</button>
							);
						})}
					</div>
				)}

				{/* Class List */}
				<div className="overflow-y-auto max-h-[40vh] p-2 border-b border-[var(--sidebar-border)]">
					{visibleClasses.length > 0 ? (
						<div className="space-y-1">
							{visibleClasses.map((cls, index) => (
								<div key={cls.id || index} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-overlay hover:bg-active transition-colors">
									{/* Status Icon */}
									<div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${(cls.attendTime === "MANUAL" ? manualMarks[cls.id] || cls.status : cls.status) === "attended" ? "bg-success/15 text-success" : (cls.attendTime === "MANUAL" ? manualMarks[cls.id] || cls.status : cls.status) === "late" ? "bg-warning/15 text-warning" : "bg-error/15 text-error"}`}>{(cls.attendTime === "MANUAL" ? manualMarks[cls.id] || cls.status : cls.status) === "attended" ? "✓" : (cls.attendTime === "MANUAL" ? manualMarks[cls.id] || cls.status : cls.status) === "late" ? "⏱" : "✗"}</div>

									{/* Info */}
									<div className="flex-1 min-w-0">
										<div className="text-xs font-medium">{cls.date}</div>
										<div className="text-[10px] text-[var(--text-tertiary)]">
											{cls.lessonTime} • {cls.roomName}
										</div>
									</div>

									{/* Attend Time or Manual Buttons */}
									<div className="text-right flex-shrink-0">
										{cls.attendTime === "MANUAL" ? (
											<div className="flex gap-1">
												<button onClick={(e) => { e.stopPropagation(); handleManualMark(cls.id, "attended"); }} className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${(manualMarks[cls.id] || cls.status) === "attended" ? "bg-success text-white" : "bg-overlay text-text-tertiary hover:bg-success/15 hover:text-success"}`} title="Mark as attended">✓</button>
												<button onClick={(e) => { e.stopPropagation(); handleManualMark(cls.id, "late"); }} className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${(manualMarks[cls.id] || cls.status) === "late" ? "bg-warning text-white" : "bg-overlay text-text-tertiary hover:bg-warning/15 hover:text-warning"}`} title="Mark as late">⏱</button>
												<button onClick={(e) => { e.stopPropagation(); handleManualMark(cls.id, "absent"); }} className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-all ${(manualMarks[cls.id] || cls.status) === "absent" ? "bg-error text-white" : "bg-overlay text-text-tertiary hover:bg-error/15 hover:text-error"}`} title="Mark as absent">✗</button>
											</div>
										) : cls.attendTime !== "-" ? (
											<div className="text-xs text-[var(--text-secondary)]">{cls.attendTime}</div>
										) : (
											<div className="text-xs text-error font-bold">ABSENT</div>
										)}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="text-center py-8 text-[var(--text-tertiary)]">No class records available</div>
					)}
				</div>
			</div>
		</div>
	);
}
