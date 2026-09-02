"use client";

import { useNow } from "@/lib/use-now";
import type { CalendarEvent } from "@/types/timetable";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

interface NextClassCardProps {
	events: CalendarEvent[];
	onSelectEvent?: (event: CalendarEvent) => void;
	onNavigateToDate?: (date: Date) => void;
}

/**
 * Hero "next class" card on the home dashboard. Picks the soonest upcoming
 * non-deadline class from the signed-in user's timetable.
 */
export default function NextClassCard({ events, onSelectEvent, onNavigateToDate }: NextClassCardProps) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const now = useNow();

	const timeLabel = useMemo(
		() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }),
		[locale],
	);

	const next = useMemo(() => {
		const nowMs = now.getTime();
		const upcoming = events.filter(
			(event) =>
				event.resource?.eventType !== "deadline" &&
				event.resource?.status !== "CANCELED" &&
				event.start.getTime() >= nowMs,
		);
		return upcoming.toSorted((a, b) => a.start.getTime() - b.start.getTime())[0] ?? null;
	}, [events, now]);

	const countdown = useMemo(() => {
		if (!next) return null;
		const mins = Math.max(0, Math.round((next.start.getTime() - now.getTime()) / 60_000));
		if (mins < 60) return t("nextClassInMinutes", { count: mins });
		const hours = Math.floor(mins / 60);
		if (hours < 24) return t("nextClassInHours", { count: hours });
		const days = Math.floor(hours / 24);
		return t("nextClassInDays", { count: days });
	}, [next, now, t]);

	const open = () => {
		if (!next) return;
		onNavigateToDate?.(next.start);
		onSelectEvent?.(next);
	};

	if (!next) {
		return (
			<section className="next-class-card is-empty" aria-label={t("nextClassLabel")}>
				<p className="next-class-kicker">{t("nextClassLabel")}</p>
				<h2>{t("nextClassEmptyTitle")}</h2>
				<p>{t("nextClassEmptyHint")}</p>
			</section>
		);
	}

	const heading = next.resource?.courseTitle || next.title;
	const code = next.resource?.courseCode;
	const sessionName = next.title && next.title !== heading ? next.title : null;
	const subtitle = [sessionName, code].filter(Boolean).join(" · ");
	const location = next.resource?.location;

	return (
		<section className="next-class-card" aria-label={t("nextClassLabel")}>
			<div className="next-class-card-glow" aria-hidden="true" />
			<div className="next-class-card-body">
				<p className="next-class-kicker">
					<span aria-hidden="true">📅</span>
					{t("nextClassLabel")}
					<span aria-hidden="true"> · </span>
					{t("nextClassEn")}
				</p>
				<h2>{heading}</h2>
				{subtitle ? <p className="next-class-sub">{subtitle}</p> : null}

				<div className="next-class-chips">
					<span>
						<Clock aria-hidden="true" />
						{timeLabel.format(next.start)} – {timeLabel.format(next.end)}
					</span>
					{location ? (
						<span>
							<MapPin aria-hidden="true" />
							{location}
						</span>
					) : null}
					{countdown ? <span className="next-class-countdown">{countdown}</span> : null}
				</div>

				<button type="button" className="next-class-action" onClick={open}>
					{t("viewClass")}
					<ArrowUpRight aria-hidden="true" />
				</button>
			</div>
		</section>
	);
}
