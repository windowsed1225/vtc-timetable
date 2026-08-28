export type PlaygroundOp =
	| { kind: "check-access-token" }
	| { kind: "timetable" }
	| { kind: "moodle" }
	| { kind: "attendance-list" }
	| { kind: "attendance-detail"; courseCode: string }
	| { kind: "print-quota" }
	| { kind: "ecard-register" }
	| { kind: "ecard-get" }
	| { kind: "ecard-refresh" };

const COURSE_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

export function isPlaygroundOwner(discordId: string, ownerDiscordId = process.env.OWNER_DISCORD_ID): boolean {
	const owner = ownerDiscordId?.trim();
	return Boolean(owner && owner === discordId);
}

export function isOwnerOnlyOp(kind: PlaygroundOp["kind"]): boolean {
	return kind === "ecard-register" || kind === "ecard-get" || kind === "ecard-refresh";
}

export function parsePlaygroundPath(method: string, path: string[]): PlaygroundOp | null {
	const verb = method.toUpperCase();
	const parts = path.filter(Boolean);

	if (verb === "GET" && parts.length === 1 && parts[0] === "check-access-token") {
		return { kind: "check-access-token" };
	}
	if (verb === "GET" && parts.length === 1 && parts[0] === "timetable") {
		return { kind: "timetable" };
	}
	if (verb === "GET" && parts.length === 1 && parts[0] === "moodle") {
		return { kind: "moodle" };
	}
	if (verb === "GET" && parts.length === 1 && parts[0] === "attendance") {
		return { kind: "attendance-list" };
	}
	if (verb === "GET" && parts.length === 2 && parts[0] === "attendance") {
		if (!COURSE_CODE.test(parts[1])) return null;
		return { kind: "attendance-detail", courseCode: parts[1] };
	}
	if (verb === "GET" && parts.length === 1 && parts[0] === "print-quota") {
		return { kind: "print-quota" };
	}
	if (verb === "GET" && parts.length === 2 && parts[0] === "ecard" && parts[1] === "register") {
		return { kind: "ecard-register" };
	}
	if (verb === "GET" && parts.length === 1 && parts[0] === "ecard") {
		return { kind: "ecard-get" };
	}
	if (verb === "POST" && parts.length === 2 && parts[0] === "ecard" && parts[1] === "refresh") {
		return { kind: "ecard-refresh" };
	}
	return null;
}

export function parseMonthYear(search: URLSearchParams): { month: number; year: number } | { error: string } {
	const now = new Date();
	const monthRaw = search.get("month");
	const yearRaw = search.get("year");
	const month = monthRaw === null || monthRaw === "" ? now.getMonth() + 1 : Number(monthRaw);
	const year = yearRaw === null || yearRaw === "" ? now.getFullYear() : Number(yearRaw);
	if (!Number.isInteger(month) || month < 1 || month > 12) {
		return { error: "month must be an integer from 1 to 12" };
	}
	if (!Number.isInteger(year) || year < 2000 || year > 2100) {
		return { error: "year must be an integer from 2000 to 2100" };
	}
	return { month, year };
}

export function parseIsPlural(search: URLSearchParams): number | { error: string } {
	const raw = search.get("isPlural");
	if (raw === null || raw === "") return 1;
	const value = Number(raw);
	if (value !== 0 && value !== 1) return { error: "isPlural must be 0 or 1" };
	return value;
}

/** Drop student photos from VTC/e-card JSON. Never returns the input object. */
export function stripPhotoStr(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(stripPhotoStr);
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
			if (key === "photoStr") continue;
			out[key] = stripPhotoStr(nested);
		}
		return out;
	}
	return value;
}

const vtcEnvelope = {
	type: "object",
	properties: {
		isSuccess: { type: "boolean" },
		errorCode: { type: "integer" },
		errorMsg: { type: ["string", "null"] },
		payload: {},
	},
} as const;

function classPaths(): Record<string, unknown> {
	return {
		"/check-access-token": {
			get: {
				tags: ["Account"],
				summary: "Check the stored VTC access token",
				description: "Uses the VTC token saved on your account. The token is not accepted in this request.",
				operationId: "checkAccessToken",
				responses: { "200": { description: "VTC envelope", content: { "application/json": { schema: vtcEnvelope } } } },
			},
		},
		"/timetable": {
			get: {
				tags: ["Timetable"],
				summary: "Class timetable and reminders",
				operationId: "getTimeTableAndReminderList",
				parameters: [
					{ name: "month", in: "query", schema: { type: "integer", minimum: 1, maximum: 12 } },
					{ name: "year", in: "query", schema: { type: "integer", minimum: 2000, maximum: 2100 } },
				],
				responses: { "200": { description: "VTC envelope", content: { "application/json": { schema: vtcEnvelope } } } },
			},
		},
		"/moodle": {
			get: {
				tags: ["Timetable"],
				summary: "Moodle deadlines",
				operationId: "getMoodleTimetable",
				parameters: [
					{ name: "month", in: "query", schema: { type: "integer", minimum: 1, maximum: 12 } },
					{ name: "year", in: "query", schema: { type: "integer", minimum: 2000, maximum: 2100 } },
					{ name: "isPlural", in: "query", schema: { type: "integer", enum: [0, 1], default: 1 } },
				],
				responses: { "200": { description: "VTC envelope", content: { "application/json": { schema: vtcEnvelope } } } },
			},
		},
		"/attendance": {
			get: {
				tags: ["Attendance"],
				summary: "Attendance list for all courses",
				operationId: "getClassAttendanceList",
				responses: { "200": { description: "VTC envelope", content: { "application/json": { schema: vtcEnvelope } } } },
			},
		},
		"/attendance/{courseCode}": {
			get: {
				tags: ["Attendance"],
				summary: "Attendance detail for one course",
				operationId: "getClassAttendanceDetail",
				parameters: [
					{
						name: "courseCode",
						in: "path",
						required: true,
						schema: { type: "string", pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$" },
					},
				],
				responses: { "200": { description: "VTC envelope", content: { "application/json": { schema: vtcEnvelope } } } },
			},
		},
		"/print-quota": {
			get: {
				tags: ["Account"],
				summary: "Campus print quota",
				operationId: "getPrintQuota",
				responses: { "200": { description: "VTC envelope", content: { "application/json": { schema: vtcEnvelope } } } },
			},
		},
	};
}

export type EcardPlaygroundSession = {
	deviceId?: string;
	accessToken?: string;
	refreshToken?: string;
};

export function dummyEcardDeviceId(): string {
	return crypto.randomUUID().toUpperCase();
}

function deviceIdParameter(dummy: string) {
	return {
		name: "deviceId",
		in: "query",
		required: false,
		description: "Prefill is a dummy uppercase UUID. You can send it as-is.",
		example: dummy,
		schema: { type: "string", format: "uuid", default: dummy, example: dummy },
	};
}

export function rememberEcardPlaygroundSession(
	body: unknown,
	session: EcardPlaygroundSession = {},
): EcardPlaygroundSession {
	if (!body || typeof body !== "object") return session;
	const record = body as Record<string, unknown>;
	const payload =
		record.payload && typeof record.payload === "object"
			? (record.payload as Record<string, unknown>)
			: null;
	const next = { ...session };
	if (typeof record.deviceId === "string" && record.deviceId.trim()) next.deviceId = record.deviceId.trim();
	const access = payload && typeof payload.accessToken === "string" ? payload.accessToken.trim() : "";
	const refresh = payload && typeof payload.refreshToken === "string" ? payload.refreshToken.trim() : "";
	if (access) next.accessToken = access;
	if (refresh) next.refreshToken = refresh;
	return next;
}

export function fillEcardPlaygroundRequest(
	url: URL,
	init: RequestInit | undefined,
	session: EcardPlaygroundSession,
	dummyDeviceId: string,
): { url: URL; init?: RequestInit } {
	const path = url.pathname.replace(/\/+$/, "");
	const isEcard = path.endsWith("/ecard") || path.includes("/ecard/");
	if (!isEcard) return { url, init };

	const next = new URL(url);
	if ((path.endsWith("/ecard/register") || path.endsWith("/ecard")) && !next.searchParams.get("deviceId")) {
		next.searchParams.set("deviceId", session.deviceId || dummyDeviceId);
	}
	if (path.endsWith("/ecard") && !path.endsWith("/ecard/register") && !next.searchParams.get("accessToken") && session.accessToken) {
		next.searchParams.set("accessToken", session.accessToken);
	}

	if (path.endsWith("/ecard/refresh") && session.refreshToken) {
		const method = (init?.method ?? "GET").toUpperCase();
		if (method === "POST") {
			let body: Record<string, unknown> = {};
			if (typeof init?.body === "string" && init.body.trim()) {
				try {
					body = JSON.parse(init.body) as Record<string, unknown>;
				} catch {
					body = {};
				}
			}
			if (typeof body.refreshToken !== "string" || !body.refreshToken.trim()) {
				return {
					url: next,
					init: {
						...init,
						headers: { ...asHeaders(init?.headers), "content-type": "application/json" },
						body: JSON.stringify({ ...body, refreshToken: session.refreshToken }),
					},
				};
			}
		}
	}

	return { url: next, init };
}

function asHeaders(headers: RequestInit["headers"]): Record<string, string> {
	if (!headers) return {};
	if (headers instanceof Headers) return Object.fromEntries(headers.entries());
	if (Array.isArray(headers)) return Object.fromEntries(headers);
	return { ...headers };
}

function ownerPaths(dummyDeviceId: string): Record<string, unknown> {
	return {
		"/ecard/register": {
			get: {
				tags: ["E-card (owner)"],
				summary: "Register an e-card session",
				description:
					"Uses the stored VTC token. If deviceId is omitted, the server sends a dummy uppercase UUID (same style as the VTC app). Photos are stripped.",
				operationId: "registerEcard",
				parameters: [deviceIdParameter(dummyDeviceId)],
				responses: { "200": { description: "E-card register envelope without photoStr, includes the deviceId used" } },
			},
		},
		"/ecard": {
			get: {
				tags: ["E-card (owner)"],
				summary: "Fetch the digital e-card",
				description:
					"If accessToken is omitted, registers first with a dummy device then fetches the card. Photos are stripped.",
				operationId: "getEcard",
				parameters: [
					{
						name: "accessToken",
						in: "query",
						required: false,
						description: "Optional e-card JWT from register. Leave empty to auto-register with a dummy device.",
						schema: { type: "string" },
					},
					deviceIdParameter(dummyDeviceId),
				],
				responses: { "200": { description: "E-card envelope without photoStr" } },
			},
		},
		"/ecard/refresh": {
			post: {
				tags: ["E-card (owner)"],
				summary: "Refresh e-card tokens",
				description: "Leave the body empty after a successful register — the last refreshToken is pasted automatically.",
				operationId: "refreshEcardToken",
				requestBody: {
					required: false,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: { refreshToken: { type: "string" } },
							},
						},
					},
				},
				responses: { "200": { description: "New access and refresh tokens" } },
			},
		},
	};
}

export function buildOpenApiDocument(options: {
	isOwner: boolean;
	origin: string;
	dummyDeviceId?: string;
}): Record<string, unknown> {
	return {
		openapi: "3.1.0",
		info: {
			title: "VTC student APIs",
			version: "1.0.0",
			description:
				"Try VTC mobile API calls with the token stored on your signed-in account. The token is attached on the server and must not be pasted here.",
		},
		servers: [{ url: `${options.origin}/api/vtc`, description: "This site (stored VTC token)" }],
		tags: options.isOwner
			? [
					{ name: "Account" },
					{ name: "Timetable" },
					{ name: "Attendance" },
					{ name: "E-card (owner)" },
				]
			: [{ name: "Account" }, { name: "Timetable" }, { name: "Attendance" }],
		paths: {
			...classPaths(),
			...(options.isOwner ? ownerPaths(options.dummyDeviceId ?? dummyEcardDeviceId()) : {}),
		},
	};
}
