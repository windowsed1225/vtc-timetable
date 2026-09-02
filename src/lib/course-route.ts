/**
 * Single source of truth for course-detail URLs.
 *
 * The canonical VTC course code (e.g. "ITP4501") is the routing key. URLs carry
 * it lowercased so links stay stable and case-insensitive, and every lookup
 * against stored events re-canonicalises it to upper case.
 */

/** Course codes are letters followed by digits, optionally with a trailing sitting letter. */
const COURSE_CODE = /^[A-Za-z]{2,6}\d{2,6}[A-Za-z]?$/;

/** Link target for a course, built from its canonical code. Never from its title. */
export function courseHref(courseCode: string): string {
	const slug = (canonicalCourseCode(courseCode) ?? courseCode.trim()).toLowerCase();
	return `/courses/${encodeURIComponent(slug)}`;
}

/**
 * Canonical (upper-case) code for a route param, or null when the segment is
 * not a course code at all, so the page renders its not-found state instead of
 * querying with junk.
 */
export function canonicalCourseCode(param: string | null | undefined): string | null {
	if (!param) return null;
	let trimmed: string;
	try {
		trimmed = decodeURIComponent(param).trim();
	} catch {
		return null;
	}
	if (!COURSE_CODE.test(trimmed)) return null;
	return trimmed.toUpperCase();
}
