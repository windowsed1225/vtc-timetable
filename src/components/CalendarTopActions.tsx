"use client";

import { exportSemesterIcs } from "@/app/actions";
import { getDefaultSemester, getSemesterDisplayLabel, getSemesterLabel } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";
import ManageEventsModal from "./ManageEventsModal";

interface CourseOption {
	courseCode: string;
	courseTitle: string;
	semester: string;
}

interface CalendarTopActionsProps {
	courses: CourseOption[];
	onRefresh: () => void;
}

const filenames: Record<number, string> = {
	1: "VTC_Schedule_Fall",
	2: "VTC_Schedule_Spring",
	3: "VTC_Schedule_Summer",
};

export default function CalendarTopActions({ courses, onRefresh }: CalendarTopActionsProps) {
	const t = useTranslations("calendar");
	const [manageOpen, setManageOpen] = useState(false);
	const [semester, setSemester] = useState(getDefaultSemester());
	const [exporting, setExporting] = useState(false);

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
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />
					</svg>
					{t("manageEvents")}
				</button>

				<details className="calendar-tools-menu">
					<summary className="calendar-action-button">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-4 w-4" aria-hidden="true">
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16" />
						</svg>
						{t("calendarTools")}
					</summary>
					<div className="calendar-tools-popover">
						<p>{t("exportDesc", { semester: getSemesterDisplayLabel(semester) })}</p>
						<select value={semester} onChange={(event) => setSemester(Number(event.target.value))} aria-label={t("semester")}>
							<option value={1}>{t("fall")}</option>
							<option value={2}>{t("spring")}</option>
							<option value={3}>{t("summer")}</option>
						</select>
						<button type="button" className="btn-primary w-full" onClick={exportCalendar} disabled={exporting}>
							{exporting ? t("exporting") : t("exportCalendar")}
						</button>
					</div>
				</details>
			</div>

			<ManageEventsModal isOpen={manageOpen} onClose={() => setManageOpen(false)} courses={courses} onRefresh={onRefresh} />
		</>
	);
}
