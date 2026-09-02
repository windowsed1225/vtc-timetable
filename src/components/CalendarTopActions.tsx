"use client";

import { exportSemesterIcs } from "@/app/actions";
import { getDefaultSemester, getSemesterDisplayLabel, getSemesterLabel } from "@/lib/utils";
import { Link } from "@/lib/navigation";
import { CalendarCog, Download, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import ManageEventsModal from "./ManageEventsModal";
import ShareCalendarButton from "./ShareCalendarButton";
import SubscribeButton from "./SubscribeButton";

interface CourseOption {
	courseCode: string;
	courseTitle: string;
	semester: string;
}

interface CalendarTopActionsProps {
	courses: CourseOption[];
	discordId?: string | null;
	onRefresh: () => void;
}

const semesterKeys: Record<number, "fall" | "spring" | "summer"> = {
	1: "fall",
	2: "spring",
	3: "summer",
};

const filenames: Record<number, string> = {
	1: "VTC_Schedule_Fall",
	2: "VTC_Schedule_Spring",
	3: "VTC_Schedule_Summer",
};

export default function CalendarTopActions({ courses, discordId, onRefresh }: CalendarTopActionsProps) {
	const t = useTranslations("calendar");
	const tAttendanceGrid = useTranslations("attendanceGrid");
	const [manageOpen, setManageOpen] = useState(false);
	const [semester, setSemester] = useState(getDefaultSemester());
	const [exporting, setExporting] = useState(false);
	const toolsRef = useRef<HTMLDetailsElement>(null);

	// Native <details> stays open on outside click; close it like the other header menus.
	useEffect(() => {
		const onPointerDown = (event: MouseEvent) => {
			const root = toolsRef.current;
			if (!root || !root.open) return;
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (root.contains(target)) return;
			// Share dialog is portaled to document.body — leave the menu alone while it is open.
			if (target instanceof Element && target.closest(".calendar-share-overlay, .calendar-share-dialog")) {
				return;
			}
			root.open = false;
		};
		document.addEventListener("mousedown", onPointerDown);
		return () => document.removeEventListener("mousedown", onPointerDown);
	}, []);

	const exportCalendar = async () => {
		setExporting(true);
		try {
			const result = await exportSemesterIcs(getSemesterLabel(semester));
			if (!result.success || !result.data) {
				alert(result.error || "Failed to export calendar");
				return;
			}

			const blob = new Blob([result.data], { type: "text/calendar;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `${filenames[semester]}.ics`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Calendar export failed:", error);
			alert("Failed to export calendar");
		} finally {
			setExporting(false);
		}
	};

	return (
		<>
			<div className="calendar-top-actions">
				<button type="button" className="calendar-action-button is-primary" onClick={() => setManageOpen(true)}>
					<CalendarCog className="h-4 w-4" aria-hidden="true" />
					{t("manageEvents")}
				</button>

				<details ref={toolsRef} className="calendar-tools-menu">
					<summary className="calendar-action-button">
						<Download className="h-4 w-4" aria-hidden="true" />
						{t("calendarTools")}
					</summary>
					<div className="calendar-tools-popover">
						<div className="calendar-tools-list">
							<Link href="/attendance-grid" className="calendar-tools-row">
								<Table2 aria-hidden="true" />
								<span>{tAttendanceGrid("navLabel")}</span>
								<span className="calendar-tools-row-chevron" aria-hidden="true">→</span>
							</Link>
							{discordId && (
								<>
									<SubscribeButton discordId={discordId} />
									<ShareCalendarButton />
								</>
							)}
						</div>

						<div className="calendar-tools-export">
							<p className="calendar-tools-section-label">{t("exportCalendar")}</p>
							<div className="calendar-tools-export-row">
								<select value={semester} onChange={(event) => setSemester(Number(event.target.value))} aria-label={t("semester")}>
									<option value={1}>{t("fall")}</option>
									<option value={2}>{t("spring")}</option>
									<option value={3}>{t("summer")}</option>
								</select>
								<button type="button" className="btn-primary" onClick={exportCalendar} disabled={exporting}>
									{exporting ? t("exporting") : t("exportBtn", { semester: t(semesterKeys[semester]) })}
								</button>
							</div>
							<p className="calendar-tools-export-description">{t("exportDesc", { semester: getSemesterDisplayLabel(semester) })}</p>
						</div>
					</div>
				</details>
			</div>

			<ManageEventsModal isOpen={manageOpen} onClose={() => setManageOpen(false)} courses={courses} onRefresh={onRefresh} />
		</>
	);
}
