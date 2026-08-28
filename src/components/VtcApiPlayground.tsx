"use client";

import {
	dummyEcardDeviceId,
	fillEcardPlaygroundRequest,
	rememberEcardPlaygroundSession,
	type EcardPlaygroundSession,
} from "@/lib/vtc-playground";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useTheme } from "next-themes";
import { useRef } from "react";

export default function VtcApiPlayground() {
	const { resolvedTheme } = useTheme();
	const ecardSession = useRef<EcardPlaygroundSession>({});
	const dummyDeviceId = useRef(dummyEcardDeviceId());

	return (
		<div className="vtc-api-playground min-h-0 flex-1">
			<ApiReferenceReact
				configuration={{
					url: "/api/openapi",
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
						const filled = fillEcardPlaygroundRequest(
							new URL(rawUrl, window.location.origin),
							init,
							ecardSession.current,
							dummyDeviceId.current,
						);
						const response = await fetch(filled.url, { ...filled.init, credentials: "include" });
						const copy = response.clone();
						try {
							ecardSession.current = rememberEcardPlaygroundSession(
								await copy.json(),
								ecardSession.current,
							);
						} catch {
							// Non-JSON responses are left as-is
						}
						return response;
					},
				}}
			/>
		</div>
	);
}
