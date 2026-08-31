const SHARE_TOKEN_BYTES = 24;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;
const DISCORD_ID_PATTERN = /^\d{17,20}$/;
const SHARE_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const SHARED_WINDOW_DAYS = 7;
const HONG_KONG_UTC_OFFSET_MS = 8 * 60 * 60 * 1_000;

export type CalendarShareView = "day" | "week" | "month";

export type SharedCalendarEvent = {
	courseCode: string;
	courseTitle: string;
	lessonType: string;
	startTime: string;
	endTime: string;
	location: string;
	colorIndex: number;
};

type ShareableEventSource = {
	courseCode: string;
	courseTitle: string;
	lessonType?: string | null;
	startTime: Date | string;
	endTime: Date | string;
	location?: string | null;
	colorIndex?: number | null;
	status?: string | null;
};

export function createCalendarShareToken(
	random: (size: number) => Uint8Array = (size) => crypto.getRandomValues(new Uint8Array(size)),
): string {
	const bytes = random(SHARE_TOKEN_BYTES);
	let token = "";
	for (let index = 0; index < bytes.length; index += 3) {
		const value = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
		token += BASE64_URL_ALPHABET[(value >>> 18) & 63];
		token += BASE64_URL_ALPHABET[(value >>> 12) & 63];
		token += BASE64_URL_ALPHABET[(value >>> 6) & 63];
		token += BASE64_URL_ALPHABET[value & 63];
	}
	return token;
}

export function isValidCalendarShareToken(token: string): boolean {
	return SHARE_TOKEN_PATTERN.test(token);
}

export function isValidDiscordId(discordId: string): boolean {
	return DISCORD_ID_PATTERN.test(discordId);
}

export function normalizeCalendarShareView(value: unknown): CalendarShareView {
	return value === "day" || value === "month" ? value : "week";
}

/** Accepts a `YYYY-MM` anchor so a shared month link keeps pointing at the same month. */
export function normalizeCalendarShareMonth(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const match = SHARE_MONTH_PATTERN.exec(value.trim());
	if (!match) return null;
	const year = Number(match[1]);
	return year >= 2000 && year <= 2100 ? `${match[1]}-${match[2]}` : null;
}

export function currentCalendarShareMonth(now: Date): string {
	const hongKongNow = new Date(now.getTime() + HONG_KONG_UTC_OFFSET_MS);
	return `${hongKongNow.getUTCFullYear()}-${String(hongKongNow.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Moves a `YYYY-MM` anchor by whole months, for the shared month view's navigation. */
export function shiftCalendarShareMonth(monthKey: string, offset: number): string {
	const anchor = normalizeCalendarShareMonth(monthKey);
	if (!anchor) return monthKey;
	const shifted = new Date(Date.UTC(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)) - 1 + offset, 1));
	return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function shareQuery(view: CalendarShareView, monthKey: string | null): string {
	const month = normalizeCalendarShareMonth(monthKey);
	return `?view=${view}${month ? `&month=${month}` : ""}`;
}

export function calendarSharePath(
	locale: "en" | "zh-HK",
	token: string,
	view: CalendarShareView = "week",
	monthKey: string | null = null,
): string | null {
	return isValidCalendarShareToken(token)
		? `/${locale}/share/calendar/${token}${shareQuery(view, monthKey)}`
		: null;
}

export function calendarOwnerViewPath(
	locale: "en" | "zh-HK",
	discordId: string,
	view: CalendarShareView = "week",
	monthKey: string | null = null,
): string | null {
	return isValidDiscordId(discordId)
		? `/${locale}/share/calendar/${discordId}${shareQuery(view, monthKey)}`
		: null;
}

export function sharedCalendarWindowEnd(now: Date): Date {
	return new Date(now.getTime() + SHARED_WINDOW_DAYS * 24 * 60 * 60 * 1_000);
}

export function calendarShareRange(
	view: CalendarShareView,
	now: Date,
	monthKey: string | null = null,
): { start: Date; end: Date } {
	const hongKongNow = new Date(now.getTime() + HONG_KONG_UTC_OFFSET_MS);
	const year = hongKongNow.getUTCFullYear();
	const month = hongKongNow.getUTCMonth();
	const day = hongKongNow.getUTCDate();
	const toUtc = (yearValue: number, monthValue: number, dayValue: number) =>
		new Date(Date.UTC(yearValue, monthValue, dayValue) - HONG_KONG_UTC_OFFSET_MS);

	if (view === "day" || view === "week") {
		return {
			start: toUtc(year, month, day),
			end: toUtc(year, month, day + (view === "day" ? 1 : SHARED_WINDOW_DAYS)),
		};
	}

	const anchor = normalizeCalendarShareMonth(monthKey);
	const anchorYear = anchor ? Number(anchor.slice(0, 4)) : year;
	const anchorMonth = anchor ? Number(anchor.slice(5, 7)) - 1 : month;

	return {
		start: toUtc(anchorYear, anchorMonth, 1),
		end: toUtc(anchorYear, anchorMonth + 1, 1),
	};
}

function safeText(value: string | null | undefined, maxLength: number): string {
	return (value ?? "").trim().slice(0, maxLength);
}

export function toSharedCalendarEvents(
	events: ShareableEventSource[],
	now: Date,
	view: CalendarShareView = "week",
	monthKey: string | null = null,
): SharedCalendarEvent[] {
	const range = calendarShareRange(view, now, monthKey);
	const rangeStartMs = range.start.getTime();
	const rangeEndMs = range.end.getTime();

	return events
		.map((event) => ({
			event,
			start: new Date(event.startTime),
			end: new Date(event.endTime),
		}))
		.filter(({ event, start, end }) =>
			Number.isFinite(start.getTime()) &&
			Number.isFinite(end.getTime()) &&
			end.getTime() >= rangeStartMs &&
			start.getTime() < rangeEndMs &&
			event.status !== "CANCELED",
		)
		.sort((a, b) => a.start.getTime() - b.start.getTime())
		.map(({ event, start, end }) => ({
			courseCode: safeText(event.courseCode, 32),
			courseTitle: safeText(event.courseTitle, 120),
			lessonType: safeText(event.lessonType, 48),
			startTime: start.toISOString(),
			endTime: end.toISOString(),
			location: safeText(event.location, 64),
			colorIndex:
				typeof event.colorIndex === "number" && Number.isInteger(event.colorIndex)
					? Math.max(0, Math.min(9, event.colorIndex))
					: 0,
		}));
}
