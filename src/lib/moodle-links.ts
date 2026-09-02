export const MOODLE_HOME_URL = "https://moodle.vtc.edu.hk/";

/**
 * VTC Moodle is served from the bare host and from year-prefixed hosts such as
 * moodle2627.vtc.edu.hk (academic year 26/27). Anything else is unverified.
 */
const VTC_MOODLE_HOST = /^moodle(?:\d{4})?\.vtc\.edu\.hk$/i;

/** VTC's Moodle only ever serves these over HTTPS on a known host, so anything
 *  else in a deadline payload is treated as unverified rather than followed. */
function parseVtcMoodleUrl(value: string | null | undefined): URL | null {
	if (!value) return null;

	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return null;
		if (!VTC_MOODLE_HOST.test(url.hostname)) return null;
		return url;
	} catch {
		return null;
	}
}

function hasNumericId(url: URL): boolean {
	return /^\d+$/.test(url.searchParams.get("id") ?? "");
}

/** Only course pages from VTC's HTTPS Moodle host are safe todo destinations. */
export function resolveMoodleCourseUrl(value: string | null | undefined): string | null {
	const url = parseVtcMoodleUrl(value);
	if (!url) return null;
	if (url.pathname !== "/course/view.php") return null;
	if (!hasNumericId(url)) return null;
	return url.toString();
}

/** An activity page — the assignment, quiz or resource a deadline points at.
 *  `getMoodleTimetable` returns these as `actionUrl`, e.g.
 *  `https://moodle2627.vtc.edu.hk/mod/assign/view.php?id=123`. */
export function resolveMoodleActivityUrl(value: string | null | undefined): string | null {
	const url = parseVtcMoodleUrl(value);
	if (!url) return null;
	if (!/^\/mod\/[a-z][a-z0-9_]*\/view\.php$/.test(url.pathname)) return null;
	if (!hasNumericId(url)) return null;
	return url.toString();
}

/**
 * Where a Moodle todo item should open. The activity itself is the most useful
 * destination, the course page is the fallback the API always carries, and a
 * null result means neither URL verified so the caller must offer Moodle home
 * instead of guessing a course id.
 */
export function resolveMoodleTodoUrl(
	actionUrl: string | null | undefined,
	courseUrl: string | null | undefined,
): string | null {
	return resolveMoodleActivityUrl(actionUrl) ?? resolveMoodleCourseUrl(courseUrl);
}

/** The Moodle module a deadline belongs to (`assign`, `quiz`, `resource`, …),
 *  read off the verified activity URL so the todo row can label itself without
 *  a second source of truth. Null when the activity link did not verify. */
export function moodleActivityModule(value: string | null | undefined): string | null {
	if (!resolveMoodleActivityUrl(value)) return null;
	return new URL(value as string).pathname.split("/")[2] ?? null;
}
