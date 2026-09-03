// Week-strip helpers for the Monday-to-Friday timetable grid.
// Dates are handled in local time; the calendar stores events as local Date
// objects built from VTC's Asia/Hong_Kong timestamps.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight at the start of `date`, without mutating the input. */
export function startOfDay(date: Date): Date {
	const copy = new Date(date.getTime());
	copy.setHours(0, 0, 0, 0);
	return copy;
}

/** Monday of the week containing `date`. Sunday belongs to the week just ended. */
export function startOfWeek(date: Date): Date {
	const day = startOfDay(date);
	const weekday = day.getDay(); // 0 = Sunday
	const offset = weekday === 0 ? -6 : 1 - weekday;
	return new Date(day.getTime() + offset * DAY_MS);
}

/** The five weekdays (Mon-Fri) of the week containing `date`. */
export function weekdaysOf(date: Date): Date[] {
	const monday = startOfWeek(date);
	return Array.from({ length: 5 }, (_, index) => new Date(monday.getTime() + index * DAY_MS));
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
	);
}

/**
 * ISO-8601 week number. Used for the week badge so the label is derived from
 * the shown dates rather than hard-coded.
 */
export function isoWeekNumber(date: Date): number {
	const target = startOfDay(date);
	// Thursday of the current ISO week decides which year the week belongs to.
	const dayNumber = (target.getDay() + 6) % 7;
	target.setDate(target.getDate() - dayNumber + 3);
	const firstThursday = new Date(target.getFullYear(), 0, 4);
	const firstDayNumber = (firstThursday.getDay() + 6) % 7;
	firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);
	return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
}

/** One step of calendar navigation, sized to the view currently on screen. */
export function stepCalendarDate(
	date: Date,
	view: "month" | "week" | "work_week" | "day" | "agenda",
	action: "PREV" | "NEXT" | "TODAY",
): Date {
	if (action === "TODAY") return new Date();
	const amount = action === "PREV" ? -1 : 1;
	if (view === "month") {
		// Step from the 1st so a 31st never overflows a shorter month and skips it
		// (31 Aug + 1 month would otherwise land on 1 Oct).
		return new Date(date.getFullYear(), date.getMonth() + amount, 1);
	}
	const days = view === "day" ? 1 : 7;
	return new Date(date.getTime() + amount * days * 24 * 60 * 60 * 1000);
}
