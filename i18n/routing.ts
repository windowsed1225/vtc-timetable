import { defineRouting } from "next-intl/routing";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

/** One year, matching the cookie configured on the routing middleware below. */
export const LOCALE_COOKIE_MAX_AGE = 31_536_000;

export const LOCALES = ["zh-HK", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-HK";

/**
 * Legacy URL prefixes and browser language tags map onto the two locales the
 * app actually ships. Anything Chinese (`zh`, `zh-TW`, `zh-Hant`, …) resolves to
 * `zh-HK`; there is deliberately no separate `zh` locale.
 */
export function normalizeLocale(value: string | null | undefined): Locale | null {
	if (!value) return null;
	const tag = value.trim().toLowerCase();
	if (!tag) return null;
	if (tag === "en" || tag.startsWith("en-")) return "en";
	if (tag === "zh" || tag.startsWith("zh")) return "zh-HK";
	return null;
}

export function isLocale(value: string | null | undefined): value is Locale {
	return value === "en" || value === "zh-HK";
}

export const routing = defineRouting({
	locales: LOCALES,
	defaultLocale: DEFAULT_LOCALE,
	// The locale lives in a cookie, never in the public URL. The middleware
	// rewrites `/settings` onto the internal `/[locale]/settings` segment.
	localePrefix: "never",
	// Cookie first, then Accept-Language, then the default locale.
	localeDetection: true,
	localeCookie: {
		name: LOCALE_COOKIE_NAME,
		maxAge: LOCALE_COOKIE_MAX_AGE,
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	},
});
