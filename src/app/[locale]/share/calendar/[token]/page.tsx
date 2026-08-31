import {
	calendarOwnerViewPath,
	calendarSharePath,
	calendarShareRange,
	currentCalendarShareMonth,
	isValidDiscordId,
	normalizeCalendarShareMonth,
	normalizeCalendarShareView,
	shiftCalendarShareMonth,
	type CalendarShareView,
	type SharedCalendarEvent,
} from "@/lib/calendar-share";
import { auth } from "@/auth";
import { LINE_COLORS } from "@/lib/colors";
import { APP_TIME_ZONE } from "@/lib/event-date";
import { loadOwnerCalendar, loadSharedCalendar } from "@/lib/load-shared-calendar";
import { Link } from "@/lib/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

type PageProps = {
	params: Promise<{ locale: string; token: string }>;
	searchParams: Promise<{ view?: string | string[]; month?: string | string[] }>;
};

function appBaseUrl(): URL {
	const configured = process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? process.env.AUTH_URL;
	const vercelHost = process.env.VERCEL_URL;
	try {
		return new URL(configured || (vercelHost ? `https://${vercelHost}` : "http://localhost:3000"));
	} catch {
		return new URL("http://localhost:3000");
	}
}

function dateKey(value: Date | string): string {
	return new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone: APP_TIME_ZONE,
	}).format(new Date(value));
}

function formatDay(value: Date | string, locale: string, compact = false): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: compact ? "short" : "long",
		month: compact ? "short" : "long",
		day: "numeric",
		timeZone: APP_TIME_ZONE,
	}).format(new Date(value));
}

function formatTime(value: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: APP_TIME_ZONE,
	}).format(new Date(value));
}

function eventsByDay(events: SharedCalendarEvent[]): Map<string, SharedCalendarEvent[]> {
	const grouped = new Map<string, SharedCalendarEvent[]>();
	for (const event of events) {
		const key = dateKey(event.startTime);
		const current = grouped.get(key) ?? [];
		current.push(event);
		grouped.set(key, current);
	}
	return grouped;
}

function rangeDays(view: CalendarShareView, now: Date, month: string | null): Date[] {
	const range = calendarShareRange(view, now, month);
	const days: Date[] = [];
	for (let cursor = range.start.getTime(); cursor < range.end.getTime(); cursor += 24 * 60 * 60 * 1_000) {
		days.push(new Date(cursor));
	}
	return days;
}

function monthLabel(month: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "long",
		timeZone: APP_TIME_ZONE,
	}).format(new Date(`${month}-15T00:00:00.000Z`));
}

function weekdayLabels(locale: string): string[] {
	return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone: APP_TIME_ZONE,
	}).format(new Date(Date.UTC(2026, 0, 4 + index))));
}

async function resolvePage(props: PageProps) {
	const [{ locale, token }, rawSearch] = await Promise.all([props.params, props.searchParams]);
	const viewValue = Array.isArray(rawSearch.view) ? rawSearch.view[0] : rawSearch.view;
	const monthValue = Array.isArray(rawSearch.month) ? rawSearch.month[0] : rawSearch.month;
	const view = normalizeCalendarShareView(viewValue);
	const month = normalizeCalendarShareMonth(monthValue);
	const displayLocale = locale === "zh-HK" ? "zh-HK" : "en";
	let shared = await loadSharedCalendar(token, view, month);
	let ownerView = false;
	if (!shared && isValidDiscordId(token)) {
		const session = await auth();
		const requesterDiscordId = session?.user?.discordId;
		if (requesterDiscordId) {
			shared = await loadOwnerCalendar(token, view, requesterDiscordId, month);
			ownerView = Boolean(shared);
		}
	}
	return { displayLocale, month, ownerView, shared, token, view };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
	const { displayLocale, month, ownerView, shared, token, view } = await resolvePage(props);
	if (!shared) return { title: "Shared calendar unavailable", robots: { index: false, follow: false } };

	const t = await getTranslations({ locale: displayLocale, namespace: "calendarShare" });
	const description = t("metaDescription", { count: shared.events.length });
	const pagePath = ownerView
		? calendarOwnerViewPath(displayLocale, token, view, month)
		: calendarSharePath(displayLocale, token, view, month);
	const imageUrl = new URL(
		`/api/calendar/share/${encodeURIComponent(token)}/image?view=${view}${view === "month" && month ? `&month=${month}` : ""}`,
		appBaseUrl(),
	);

	return {
		title: `${t("title")} · ${view === "month" && month ? monthLabel(month, displayLocale) : t(`view.${view}`)}`,
		description,
		robots: { index: false, follow: false },
		openGraph: {
			type: "website",
			url: pagePath ? new URL(pagePath, appBaseUrl()) : undefined,
			title: t("title"),
			description,
			locale: displayLocale === "zh-HK" ? "zh_HK" : "en_HK",
			...(ownerView ? {} : { images: [{ url: imageUrl, width: 1200, height: 630, alt: t("title") }] }),
		},
		twitter: {
			card: ownerView ? "summary" : "summary_large_image",
			title: t("title"),
			description,
			...(ownerView ? {} : { images: [imageUrl] }),
		},
	};
}

function SharedEventCard({
	event,
	locale,
	roomTba,
	compact = false,
}: {
	event: SharedCalendarEvent;
	locale: string;
	roomTba: string;
	compact?: boolean;
}) {
	return (
		<article
			className={`shared-calendar-event${compact ? " is-compact" : ""}`}
			style={{ "--share-line": LINE_COLORS[event.colorIndex] ?? LINE_COLORS[0] } as CSSProperties}
		>
			<time dateTime={event.startTime}>
				{formatTime(event.startTime, locale)}–{formatTime(event.endTime, locale)}
			</time>
			<div>
				<strong>{event.courseCode}</strong>
				{compact ? null : <span>{event.courseTitle}</span>}
			</div>
			<small>{event.location || roomTba}</small>
		</article>
	);
}

export default async function SharedCalendarPage(props: PageProps) {
	const { displayLocale, month, ownerView, shared, token, view } = await resolvePage(props);
	if (!shared) notFound();
	const t = await getTranslations({ locale: displayLocale, namespace: "calendarShare" });
	const grouped = eventsByDay(shared.events);
	const days = rangeDays(view, new Date(), month);
	const activeMonth = month ?? currentCalendarShareMonth(new Date());
	const monthHref = (target: string) => (ownerView
		? calendarOwnerViewPath(displayLocale, token, "month", target)
		: calendarSharePath(displayLocale, token, "month", target));
	const firstMonthWeekday = view === "month" && days[0]
		? new Date(days[0].getTime() + 8 * 60 * 60 * 1_000).getUTCDay()
		: 0;
	const weekdays = weekdayLabels(displayLocale);

	return (
		<main className="shared-calendar-page">
			<section className="shared-calendar-shell">
				<header className="shared-calendar-header">
					<div>
						<p>{t("eyebrow")}</p>
						<h1>{t("title")}</h1>
						<span>{view === "month" ? t("subtitle.monthOf", { month: monthLabel(activeMonth, displayLocale) }) : t(`subtitle.${view}`)}</span>
					</div>
					<div className="shared-calendar-privacy-badge">{t(ownerView ? "ownerViewBadge" : "privacyBadge")}</div>
				</header>

				<nav className="shared-calendar-view-tabs" aria-label={t("title")}>
					{(["day", "week", "month"] as const).map((option) => {
						const href = ownerView
							? calendarOwnerViewPath(displayLocale, token, option, month)
							: calendarSharePath(displayLocale, token, option, month);
						return href ? (
							<a key={option} href={href} className={view === option ? "is-active" : ""} aria-current={view === option ? "page" : undefined}>
								{t(`view.${option}`)}
							</a>
						) : null;
					})}
				</nav>

				{view === "month" ? (
					<nav className="shared-calendar-month-nav" aria-label={t("view.month")}>
						<a href={monthHref(shiftCalendarShareMonth(activeMonth, -1)) ?? undefined} rel="nofollow">
							<span aria-hidden="true">←</span> {t("previousMonth")}
						</a>
						<strong>{monthLabel(activeMonth, displayLocale)}</strong>
						<a href={monthHref(shiftCalendarShareMonth(activeMonth, 1)) ?? undefined} rel="nofollow">
							{t("nextMonth")} <span aria-hidden="true">→</span>
						</a>
					</nav>
				) : null}

				{shared.events.length === 0 ? (
					<div className="shared-calendar-empty">
						<h2>{t("noClassesTitle")}</h2>
						<p>{t("noClassesDescription")}</p>
					</div>
				) : view === "month" ? (
					<div className="shared-calendar-month-grid">
						{weekdays.map((weekday) => <div key={weekday} className="shared-calendar-weekday">{weekday}</div>)}
						{Array.from({ length: firstMonthWeekday }, (_, index) => <div key={`blank-${index}`} className="is-blank" aria-hidden="true" />)}
						{days.map((day) => {
							const events = grouped.get(dateKey(day)) ?? [];
							return (
								<section key={dateKey(day)} className="shared-calendar-month-day">
									<h2>{formatDay(day, displayLocale, true)}</h2>
									{events.slice(0, 3).map((event) => <SharedEventCard key={`${event.courseCode}-${event.startTime}`} event={event} locale={displayLocale} roomTba={t("roomTba")} compact />)}
									{events.length > 3 ? <small>+{events.length - 3}</small> : null}
								</section>
							);
						})}
					</div>
				) : (
					<div className={`shared-calendar-agenda is-${view}`}>
						{days.map((day) => {
							const events = grouped.get(dateKey(day)) ?? [];
							return (
								<section key={dateKey(day)} className="shared-calendar-day">
									<h2>{formatDay(day, displayLocale)}</h2>
									<div>
										{events.length ? events.map((event) => <SharedEventCard key={`${event.courseCode}-${event.startTime}`} event={event} locale={displayLocale} roomTba={t("roomTba")} />) : <span className="shared-calendar-day-empty">—</span>}
									</div>
								</section>
							);
						})}
					</div>
				)}

				<footer className="shared-calendar-footer">
					<p>{t("liveNote")}</p>
					<Link href="/">{t("backToApp")} <span aria-hidden="true">→</span></Link>
				</footer>
			</section>
		</main>
	);
}
