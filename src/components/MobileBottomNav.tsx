"use client";

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
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 3v3m12-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
				<span>{t("calendarTab")}</span>
			</button>
			<button type="button" className={active === "attendance" ? "is-active" : ""} onClick={onAttendance} aria-current={active === "attendance" ? "page" : undefined}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 20V10m7 10V4m7 16v-7" /></svg>
				<span>{t("attendanceTab")}</span>
			</button>
			<button type="button" onClick={onMore}>
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
				<span>{t("moreTab")}</span>
			</button>
		</nav>
	);
}
