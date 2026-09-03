import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import {
	LOCALE_COOKIE_MAX_AGE,
	LOCALE_COOKIE_NAME,
	normalizeLocale,
	routing,
} from "../i18n/routing";

// In Next.js 16, this file is named proxy.ts instead of middleware.ts. It has
// to sit beside the routes directory — `src/`, not the repo root — or it is
// never loaded.
const handleI18nRouting = createMiddleware(routing);

// The request type comes from the routing middleware itself: `next` and
// `@vinext/types` each ship their own `NextRequest`, and only this one is
// guaranteed to be the shape `handleI18nRouting` accepts.
type ProxyRequest = Parameters<typeof handleI18nRouting>[0];

/**
 * Prefixes the app used to serve before the locale moved into a cookie. They
 * remain valid as a one-time entry point: the prefix picks the locale, then the
 * visitor is redirected to the same path without it.
 */
const LEGACY_PREFIXES = ["en", "zh-HK", "zh-Hant", "zh-TW", "zh"];

function legacyPrefixOf(pathname: string): string | null {
	// Match case-insensitively — `/ZH-hk/settings` was reachable before too.
	const segment = pathname.split("/")[1] ?? "";
	if (!segment) return null;
	const match = LEGACY_PREFIXES.find((prefix) => prefix.toLowerCase() === segment.toLowerCase());
	return match ? segment : null;
}

export default function proxy(request: ProxyRequest) {
	const { pathname, search } = request.nextUrl;
	const prefix = legacyPrefixOf(pathname);

	if (prefix) {
		// The fragment never reaches the server, so the browser carries it over
		// to the redirect target on its own.
		const target = request.nextUrl.clone();
		target.pathname = pathname.slice(prefix.length + 1) || "/";
		target.search = search;

		const locale = normalizeLocale(prefix) ?? routing.defaultLocale;
		const response = NextResponse.redirect(target);
		response.cookies.set(LOCALE_COOKIE_NAME, locale, {
			path: "/",
			maxAge: LOCALE_COOKIE_MAX_AGE,
			sameSite: "lax",
			secure: process.env.NODE_ENV === "production",
			httpOnly: false,
		});
		return response;
	}

	return handleI18nRouting(request);
}

export const config = {
	// Match all paths except Next.js internals, API route handlers, and static
	// files. `api/` needs the trailing slash: the route handlers live under
	// `/api/...`, while `/api` itself is the VTC playground page and has to be
	// rewritten onto the locale segment like any other page.
	matcher: ["/((?!api/|_next|.*\\..*).*)"],
};
