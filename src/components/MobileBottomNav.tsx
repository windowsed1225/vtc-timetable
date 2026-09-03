"use client";

import { BarChart3, CalendarDays, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

interface MobileBottomNavProps {
	active: "calendar" | "attendance";
	onCalendar: () => void;
	onAttendance: () => void;
	onMore: () => void;
}

export default function MobileBottomNav({ active, onCalendar, onAttendance, onMore }: MobileBottomNavProps) {
	const t = useTranslations("calendar");

	return (
		<nav className="mobile-bottom-nav" aria-label="Primary navigation">
			<button type="button" className={active === "calendar" ? "is-active" : ""} onClick={onCalendar} aria-current={active === "calendar" ? "page" : undefined}>
				<CalendarDays aria-hidden="true" />
				<span>{t("calendarTab")}</span>
			</button>
			<button type="button" className={active === "attendance" ? "is-active" : ""} onClick={onAttendance} aria-current={active === "attendance" ? "page" : undefined}>
				<BarChart3 aria-hidden="true" />
				<span>{t("attendanceTab")}</span>
			</button>
			<button type="button" onClick={onMore}>
				<MoreHorizontal aria-hidden="true" />
				<span>{t("moreTab")}</span>
			</button>
		</nav>
	);
}
