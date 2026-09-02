"use client";

import CampusHeader from "@/components/CampusHeader";
import { getAcademicYear } from "@/lib/utils";
import { isoWeekNumber } from "@/lib/week";
import type { CalendarEvent } from "@/types/timetable";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

interface DashboardOverviewProps {
	events: CalendarEvent[];
	userName?: string | null;
	tokenExpired?: boolean;
	onSelectEvent?: (event: CalendarEvent) => void;
	onNavigateToDate?: (date: Date) => void;
	headerActions?: ReactNode;
	/** Any date inside the week the page is currently showing. */
	weekDate: Date;
}

/** Page chrome for the timetable route: the shared greeting row, then this
 *  page's own breadcrumb, title and year/week badge. */
export default function DashboardOverview({ weekDate, ...header }: DashboardOverviewProps) {
	const t = useTranslations("dashboard");

	return (
		<>
			<CampusHeader {...header} />

			<div className="campus-page-heading">
				<p className="campus-breadcrumb">{t("breadcrumb")}</p>
				<div>
					<div className="min-w-0">
						<h2>{t("pageTitle")}</h2>
						<p>{t("pageSubtitle")}</p>
					</div>
					<span className="campus-week-badge">
						{t("yearWeekBadge", { year: getAcademicYear(weekDate), week: isoWeekNumber(weekDate) })}
					</span>
				</div>
			</div>
		</>
	);
}
