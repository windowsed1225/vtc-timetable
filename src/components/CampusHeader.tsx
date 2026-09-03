"use client";

import { useNow } from "@/lib/use-now";
import type { CalendarEvent } from "@/types/timetable";
import { Bell, Clock, MapPin, Search, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface CampusHeaderProps {
	events: CalendarEvent[];
	userName?: string | null;
	/** Shown as the first notification while the stored VTC token is rejected. */
	tokenExpired?: boolean;
	onSelectEvent?: (event: CalendarEvent) => void;
	/** Moves the calendar (and the week strip above it) to the given day. */
	onNavigateToDate?: (date: Date) => void;
	/** Shell-level controls (calendar tools, account menu) rendered in the header row. */
	headerActions?: ReactNode;
}

const DEADLINE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Greeting row shared by every signed-in route: date and time of day, the
 * user's name, today's class count, class search and notifications. Every value
 * is derived from the signed-in user's synced events, never sample data.
 */
export default function CampusHeader({
	events,
	userName,
	tokenExpired,
	onSelectEvent,
	onNavigateToDate,
	headerActions,
}: CampusHeaderProps) {
	const t = useTranslations("dashboard");
	const locale = useLocale();
	const now = useNow();

	const [query, setQuery] = useState("");
	const [showNotifications, setShowNotifications] = useState(false);
	const searchRef = useRef<HTMLDivElement>(null);
	const bellRef = useRef<HTMLDivElement>(null);

	const dateLabel = useMemo(
		() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(now),
		[locale, now],
	);
	const timeFormatter = useMemo(
		() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }),
		[locale],
	);
	const dayFormatter = useMemo(
		() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }),
		[locale],
	);

	const partOfDay = useMemo(() => {
		const hour = now.getHours();
		if (hour < 12) return t("morning");
		if (hour < 18) return t("afternoon");
		return t("evening");
	}, [now, t]);

	const classes = useMemo(() => events.filter((event) => event.resource?.eventType !== "deadline"), [events]);

	const todayCount = useMemo(() => {
		const today = now.toDateString();
		return classes.filter(
			(event) => event.start.toDateString() === today && event.resource?.status !== "CANCELED",
		).length;
	}, [classes, now]);

	const results = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (needle.length < 2) return [];
		return classes
			.filter((event) => {
				const resource = event.resource;
				return (
					(resource?.courseCode ?? "").toLowerCase().includes(needle) ||
					(resource?.courseTitle ?? event.title).toLowerCase().includes(needle) ||
					(resource?.location ?? "").toLowerCase().includes(needle)
				);
			})
			.sort((a, b) => a.start.getTime() - b.start.getTime())
			.slice(0, 8);
	}, [classes, query]);

	const notifications = useMemo(() => {
		const nowMs = now.getTime();
		const items: { id: string; text: string; event?: CalendarEvent; warning?: boolean }[] = [];

		if (tokenExpired) {
			items.push({ id: "token", text: t("notifTokenExpired"), warning: true });
		}

		for (const event of events) {
			if (event.resource?.eventType !== "deadline") continue;
			const due = event.end.getTime();
			if (due < nowMs || due > nowMs + DEADLINE_WINDOW_MS) continue;
			items.push({
				id: `deadline-${event.start.getTime()}-${event.title}`,
				text: t("notifDeadline", { title: event.title, when: dayFormatter.format(event.end) }),
				event,
			});
		}

		const nextClass = classes
			.filter((event) => event.start.getTime() >= nowMs && event.resource?.status !== "CANCELED")
			.sort((a, b) => a.start.getTime() - b.start.getTime())[0];
		if (nextClass) {
			items.push({
				id: `next-${nextClass.start.getTime()}`,
				text: t("notifNextClass", {
					title: nextClass.resource?.courseTitle || nextClass.title,
					when: `${dayFormatter.format(nextClass.start)} ${timeFormatter.format(nextClass.start)}`,
				}),
				event: nextClass,
			});
		}

		return items.slice(0, 6);
	}, [classes, dayFormatter, events, now, t, timeFormatter, tokenExpired]);

	// Dismiss the search results and the notification popover on outside click.
	useEffect(() => {
		function onPointerDown(pointerEvent: MouseEvent) {
			const target = pointerEvent.target as Node;
			if (searchRef.current && !searchRef.current.contains(target)) setQuery("");
			if (bellRef.current && !bellRef.current.contains(target)) setShowNotifications(false);
		}
		document.addEventListener("mousedown", onPointerDown);
		return () => document.removeEventListener("mousedown", onPointerDown);
	}, []);

	const openEvent = (event: CalendarEvent) => {
		onNavigateToDate?.(event.start);
		onSelectEvent?.(event);
		setQuery("");
		setShowNotifications(false);
	};

	const firstName = userName ? userName.split(" ")[0] : null;

	return (
			<header className="campus-header">
				<div className="min-w-0">
					<p className="campus-kicker">
						{dateLabel} · {partOfDay}
					</p>
					<h1>{firstName ? t("greetingNamed", { name: firstName }) : t("greeting")}</h1>
					<p className="campus-muted">{t("todaySummary", { count: todayCount, courses: classes.length })}</p>
				</div>

				<div className="campus-header-actions">
					<div className="campus-search" ref={searchRef}>
						<Search aria-hidden="true" />
						<input
							type="search"
							value={query}
							onChange={(changeEvent) => setQuery(changeEvent.target.value)}
							placeholder={t("searchPlaceholder")}
							aria-label={t("searchLabel")}
						/>
						{query.trim().length >= 2 && (
							<div className="campus-search-results" role="listbox" aria-label={t("searchLabel")}>
								{results.length === 0 ? (
									<p className="campus-search-empty">{t("searchNoResults")}</p>
								) : (
									results.map((event) => (
										<button
											key={`${event.start.getTime()}-${event.resource?.courseCode ?? event.title}`}
											type="button"
											role="option"
											aria-selected="false"
											onClick={() => openEvent(event)}
										>
											<strong>{event.resource?.courseTitle || event.title}</strong>
											<span>
												<Clock aria-hidden="true" />
												{dayFormatter.format(event.start)} {timeFormatter.format(event.start)}
												{event.resource?.location ? (
													<>
														<MapPin aria-hidden="true" />
														{event.resource.location}
													</>
												) : null}
											</span>
										</button>
									))
								)}
							</div>
						)}
					</div>

					<div className="campus-bell-wrap" ref={bellRef}>
						<button
							type="button"
							className="campus-icon-button"
							aria-label={t("notificationsLabel")}
							aria-expanded={showNotifications}
							onClick={() => setShowNotifications((open) => !open)}
						>
							<Bell aria-hidden="true" />
							{notifications.length > 0 && <span className="campus-bell-dot" aria-hidden="true" />}
						</button>

						{showNotifications && (
							<div className="campus-notifications" role="dialog" aria-label={t("notificationsLabel")}>
								{notifications.length === 0 ? (
									<p className="campus-search-empty">{t("notificationsEmpty")}</p>
								) : (
									notifications.map((item) =>
										item.event ? (
											<button key={item.id} type="button" onClick={() => openEvent(item.event as CalendarEvent)}>
												{item.text}
											</button>
										) : (
											<p key={item.id} data-warning={item.warning ? "" : undefined}>
												<TriangleAlert aria-hidden="true" />
												{item.text}
											</p>
										),
									)
								)}
							</div>
						)}
					</div>

					{headerActions}
				</div>
			</header>
	);
}
