import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, isLocale, normalizeLocale, routing, type Locale } from "./routing";

/** First tag in an `Accept-Language` header that maps onto a shipped locale. */
function localeFromAcceptLanguage(header: string | null): Locale | null {
	if (!header) return null;
	const tags = header
		.split(",")
		.map((part) => {
			const [tag, ...params] = part.trim().split(";");
			const q = params.find((param) => param.trim().startsWith("q="));
			return { tag: tag.trim(), q: q ? Number.parseFloat(q.trim().slice(2)) : 1 };
		})
		.filter((entry) => entry.tag && !Number.isNaN(entry.q))
		.toSorted((a, b) => b.q - a.q);

	for (const { tag } of tags) {
		const locale = normalizeLocale(tag);
		if (locale) return locale;
	}
	return null;
}

export default getRequestConfig(async ({ requestLocale }) => {
	// Inside `[locale]` this is the rewritten segment. The root layout renders
	// above that segment, so there it resolves the same way the middleware does:
	// cookie, then Accept-Language, then the default locale. Without this the
	// `<html lang>` attribute would be stuck on the default.
	const segmentLocale = await requestLocale;
	let locale: Locale | null = isLocale(segmentLocale) ? segmentLocale : null;

	if (!locale) {
		const cookieStore = await cookies();
		locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
	}

	if (!locale) {
		const headerStore = await headers();
		locale = localeFromAcceptLanguage(headerStore.get("accept-language"));
	}

	locale ??= routing.defaultLocale;

	return {
		locale,
		messages: (await import(`../messages/${locale}.json`)).default,
	};
});
