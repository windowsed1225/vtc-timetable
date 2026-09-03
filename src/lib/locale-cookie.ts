import {
	LOCALE_COOKIE_MAX_AGE,
	LOCALE_COOKIE_NAME,
	type Locale,
} from "../../i18n/routing";

/**
 * Serialized locale cookie. The middleware reads this on every request, so the
 * attributes have to match the ones it writes itself — otherwise the browser
 * keeps two cookies and the older one can win.
 */
export function localeCookieValue(locale: Locale): string {
	const attributes = [
		`${LOCALE_COOKIE_NAME}=${locale}`,
		"Path=/",
		`Max-Age=${LOCALE_COOKIE_MAX_AGE}`,
		"SameSite=Lax",
	];
	// Not HttpOnly by design: the language switcher sets it from the client.
	if (window.location.protocol === "https:") attributes.push("Secure");
	return attributes.join("; ");
}

/** Writes the locale cookie. Callers refresh or reload to re-render in it. */
export function writeLocaleCookie(locale: Locale): void {
	document.cookie = localeCookieValue(locale);
}
