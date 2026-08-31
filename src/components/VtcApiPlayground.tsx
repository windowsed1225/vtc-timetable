"use client";

import {
	dummyEcardDeviceId,
	ecardSessionKey,
	fillEcardPlaygroundRequest,
	isValidTargetDiscordId,
	loadEcardDeviceIds,
	rememberEcardPlaygroundSession,
	saveEcardDeviceIds,
	resolvePlaygroundRequestUrl,
	type EcardPlaygroundSession,
} from "@/lib/vtc-playground";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

export default function VtcApiPlayground() {
	const t = useTranslations("apiPlayground");
	const { resolvedTheme } = useTheme();
	const ecardSessions = useRef(new Map<string, EcardPlaygroundSession>());
	// A device UUID stays bound to the first card registered with it, so never share one across
	// accounts, and keep each account's id across reloads so GET /ecard can reuse the registration.
	const deviceIds = useRef<Map<string, string> | null>(null);

	function deviceIdFor(sessionKey: string): string {
		const known = (deviceIds.current ??= loadEcardDeviceIds(globalThis.localStorage));
		const existing = known.get(sessionKey);
		if (existing) return existing;
		const created = dummyEcardDeviceId();
		known.set(sessionKey, created);
		saveEcardDeviceIds(globalThis.localStorage, known);
		return created;
	}

	const [isOwner, setIsOwner] = useState(false);
	const [actAs, setActAs] = useState("");
	// Read by the fetch interceptor, which Scalar keeps from its first render.
	const actAsRef = useRef("");
	actAsRef.current = isValidTargetDiscordId(actAs) ? actAs.trim() : "";

	useEffect(() => {
		let cancelled = false;
		void fetch("/api/openapi", { credentials: "include" })
			.then((response) => (response.ok ? response.json() : null))
			.then((spec) => {
				if (!cancelled && spec?.paths?.["/db/account"]) setIsOwner(true);
			})
			.catch(() => {
				// A visitor simply has no account switch.
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const trimmed = actAs.trim();
	const invalid = trimmed !== "" && !isValidTargetDiscordId(trimmed);

	return (
		<div className="vtc-api-playground min-h-0 flex-1 flex flex-col">
			{isOwner && (
				<div className="border-b border-border-default bg-[var(--bg-subtle)] px-4 py-3">
					<label htmlFor="vtc-act-as" className="block text-sm font-medium">
						{t("actAsLabel")}
					</label>
					<input
						id="vtc-act-as"
						value={actAs}
						onChange={(event) => setActAs(event.target.value)}
						placeholder={t("actAsPlaceholder")}
						inputMode="numeric"
						autoComplete="off"
						spellCheck={false}
						aria-invalid={invalid}
						className="mt-1 w-full max-w-md rounded-md border border-border-default bg-[var(--background)] px-3 py-2 text-sm"
					/>
					<p className="mt-1 text-xs text-[var(--text-secondary)]">
						{invalid ? t("actAsInvalid") : actAsRef.current ? t("actAsActive", { discordId: actAsRef.current }) : t("actAsHint")}
					</p>
				</div>
			)}
			<div className="min-h-0 flex-1">
				<ApiReferenceReact
					configuration={{
						url: "/api/openapi",
						servers: [{ url: "/api/vtc", description: "This site (stored VTC token)" }],
						withDefaultFonts: false,
						hideClientButton: true,
						forceDarkModeState: resolvedTheme === "light" ? "light" : "dark",
						fetch: async (input, init) => {
							const rawUrl =
								typeof input === "string"
									? input
									: input instanceof URL
										? input.toString()
										: input.url;
							const requestUrl = resolvePlaygroundRequestUrl(rawUrl, window.location.origin);
							// The form's own discordId row wins when it is actually sent; otherwise the
							// account switch above applies, so a request can never silently target the caller.
							if (actAsRef.current && !requestUrl.searchParams.get("discordId")) {
								requestUrl.searchParams.set("discordId", actAsRef.current);
							}
							const sessionKey = ecardSessionKey(requestUrl);
							const filled = fillEcardPlaygroundRequest(
								requestUrl,
								init,
								ecardSessions.current.get(sessionKey) ?? {},
								deviceIdFor(sessionKey),
							);
							const response = await fetch(filled.url, { ...filled.init, credentials: "include" });
							const copy = response.clone();
							try {
								ecardSessions.current.set(
									sessionKey,
									rememberEcardPlaygroundSession(await copy.json(), ecardSessions.current.get(sessionKey) ?? {}),
								);
							} catch {
								// Non-JSON responses are left as-is
							}
							return response;
						},
					}}
				/>
			</div>
		</div>
	);
}
