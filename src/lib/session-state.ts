/**
 * Single source of truth for "where does this class stand right now".
 *
 * The week strip, month grid and agenda all read `sessionState`, and the
 * attendance sync reads `isLockedSession`, so what the UI calls settled and
 * what the sync refuses to overwrite can never drift apart.
 */

export type SessionState =
	| "upcoming"
	| "ongoing"
	/** Ended today, no official result yet. VTC publishes it the next day. */
	| "awaiting"
	| "attended"
	| "absent"
	| "cancelled"
	/** Ended before today and still has no official result. */
	| "noRecord";

/** The fields any lock decision needs, from a Mongo document or a CalendarEvent. */
export interface SessionStatusSource {
	attendanceStatusCode?: number | null;
	status?: string | null;
}

/**
 * True once VTC has published a presence code for the class. `status:
 * "FINISHED"` is NOT proof: the plain timetable sync writes it for any class
 * whose end time has passed, with `attendanceStatusCode: null`.
 */
export function hasOfficialResult(source: SessionStatusSource): boolean {
	return source.attendanceStatusCode === 1 || source.attendanceStatusCode === 3;
}

/**
 * A class whose outcome is settled. The attendance sync must not rewrite these
 * — a later room or lecturer change upstream would otherwise overwrite a class
 * the user already sat.
 */
export function isLockedSession(source: SessionStatusSource): boolean {
	return hasOfficialResult(source) || source.status === "ABSENT" || source.status === "CANCELED";
}

/** Local calendar day, so "today" follows the device rather than UTC. */
function isSameLocalDay(a: Date, b: Date): boolean {
	return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface SessionTiming extends SessionStatusSource {
	start: Date;
	end: Date;
}

export function sessionState(session: SessionTiming, now: Date): SessionState {
	if (session.status === "CANCELED") return "cancelled";
	if (session.status === "ABSENT") return "absent";
	if (hasOfficialResult(session)) return "attended";

	if (session.start > now) return "upcoming";
	if (session.end > now) return "ongoing";

	// Ended with nothing official yet. VTC only publishes the day after, so say
	// so for today and stop promising it once the day has passed.
	return isSameLocalDay(session.end, now) ? "awaiting" : "noRecord";
}
