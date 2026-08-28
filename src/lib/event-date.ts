export const APP_TIME_ZONE = "Asia/Hong_Kong";

export function isValidDate(value: Date | string | number | null | undefined): value is Date {
	if (value instanceof Date) return Number.isFinite(value.getTime());
	if (typeof value === "string" || typeof value === "number") {
		return Number.isFinite(new Date(value).getTime());
	}
	return false;
}

export function toValidDate(value: Date | string | number | null | undefined): Date | null {
	if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
	if (value === null || value === undefined) return null;
	const date = new Date(value);
	return Number.isFinite(date.getTime()) ? date : null;
}

export function formatClassDate(
	value: Date | string | number,
	locale: string,
	timeZone: string = APP_TIME_ZONE,
): string | null {
	const date = toValidDate(value);
	if (!date) return null;

	return new Intl.DateTimeFormat(locale, {
		weekday: "long",
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone,
	}).format(date);
}

export function formatCompactClassDate(
	value: Date | string | number,
	locale: string,
	timeZone: string = APP_TIME_ZONE,
): string | null {
	const date = toValidDate(value);
	if (!date) return null;

	return new Intl.DateTimeFormat(locale, {
		weekday: "short",
		month: "short",
		day: "numeric",
		timeZone,
	}).format(date);
}
