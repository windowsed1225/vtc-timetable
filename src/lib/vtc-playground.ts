export type PlaygroundOp =
	| { kind: "check-access-token" }
	| { kind: "timetable" }
	| { kind: "moodle" }
	| { kind: "attendance-list" }
	| { kind: "attendance-detail"; courseCode: string }
	| { kind: "print-quota" }
	| { kind: "ecard-register" }
	| { kind: "ecard-get" }
	| { kind: "ecard-refresh" }
	| { kind: "db-account" }
	| { kind: "db-user" }
	| { kind: "db-events" }
	| { kind: "db-attendance" };

const COURSE_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

export function isPlaygroundOwner(discordId: string, ownerDiscordId = process.env.OWNER_DISCORD_ID): boolean {
	const owner = ownerDiscordId?.trim();
	return Boolean(owner && owner === discordId);
}

export function isOwnerOnlyOp(kind: PlaygroundOp["kind"]): boolean {
	return kind.startsWith("ecard-") || kind.startsWith("db-");
}

/** Stored-data reads answer from MongoDB only, so a broken VTC token cannot affect them. */
export function isStoredDataOp(kind: PlaygroundOp["kind"]): boolean {
	return kind.startsWith("db-");
}

/**
 * A stored token and the `vtcStudentId` beside it are written together from one
 * checkAccessToken response, so a disagreement means the row was corrupted by an older
 * write path and the token belongs to someone else. Returning it would silently hand the
 * caller the wrong student's data.
 */
export function mismatchedAccountError(storedStudentId: string | null, tokenStudentId: string): string | null {
	if (!storedStudentId || storedStudentId === tokenStudentId) return null;
	return `That account's stored VTC token authenticates as ${tokenStudentId}, but the account is registered as ${storedStudentId}. The token no longer belongs to that account — it must sign in and sync again.`;
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
	if (verb === "GET" && parts.length === 2 && parts[0] === "db") {
		if (parts[1] === "account") return { kind: "db-account" };
		if (parts[1] === "user") return { kind: "db-user" };
		if (parts[1] === "events") return { kind: "db-events" };
		if (parts[1] === "attendance") return { kind: "db-attendance" };
		return null;
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

const DISCORD_ID = /^\d{17,20}$/;

/** Owner-only: which account's stored VTC token the playground call should use. */
export function isValidTargetDiscordId(value: string): boolean {
	return DISCORD_ID.test(value.trim());
}

export function parseTargetDiscordId(search: URLSearchParams): string | null | { error: string } {
	const raw = search.get("discordId")?.trim();
	if (!raw) return null;
	if (!DISCORD_ID.test(raw)) return { error: "discordId must be a Discord snowflake (17-20 digits)" };
	return raw;
}

/** Drop student photos from VTC/e-card JSON. Never returns the input object. */
export function stripPhotoStr(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(stripPhotoStr);
	}
	if (value && typeof value === "object") {
		// Dates, ObjectIds and Buffers carry their own toJSON; walking their entries would
		// flatten a Date to {} and an ObjectId to its internal buffer.
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== Object.prototype && prototype !== null) return value;

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

export const PLAYGROUND_DEVICE_ID_STORAGE_KEY = "vtc-playground-device-ids";

type DeviceIdStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * A device UUID stays bound upstream to the first card registered with it, so it has to
 * outlive the page: a fresh one per reload would leave GET /ecard unable to reuse an
 * earlier registration. Storage can be unavailable (private mode, blocked site data),
 * which only costs the caller that reuse, so it falls back to in-memory ids.
 */
export function loadEcardDeviceIds(storage: DeviceIdStorage | undefined): Map<string, string> {
	let raw: string | null = null;
	try {
		raw = storage?.getItem(PLAYGROUND_DEVICE_ID_STORAGE_KEY) ?? null;
	} catch {
		return new Map();
	}
	if (!raw) return new Map();
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return new Map();
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return new Map();
	const entries = Object.entries(parsed as Record<string, unknown>).flatMap<[string, string]>(([key, value]) =>
		typeof value === "string" && value.trim() ? [[key, value.trim()]] : [],
	);
	return new Map(entries);
}

export function saveEcardDeviceIds(storage: DeviceIdStorage | undefined, deviceIds: Map<string, string>): void {
	try {
		storage?.setItem(PLAYGROUND_DEVICE_ID_STORAGE_KEY, JSON.stringify(Object.fromEntries(deviceIds)));
	} catch {
		// Storage being unavailable only loses reuse across reloads.
	}
}

/**
 * Deliberately unprefilled. A device UUID stays bound to the first card registered with it
 * upstream, so a single shared default would make every account's register return that card.
 * Left empty, the playground sends a fresh UUID per account.
 */
function deviceIdParameter() {
	return {
		name: "deviceId",
		in: "query",
		required: false,
		description:
			"Leave empty. The playground sends a fresh uppercase UUID per account — a device UUID stays bound to the first card registered with it.",
		schema: { type: "string", format: "uuid" },
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

/**
 * E-card JWTs identify the cardholder, not the caller, so a remembered access/refresh
 * token must never be replayed against a different account's request.
 */
export function ecardSessionKey(url: URL): string {
	return url.searchParams.get("discordId")?.trim() ?? "";
}

/**
 * Session cookies are SameSite=Lax, so a cross-site top-level GET still carries them and
 * these routes have upstream VTC side effects. Browsers that send Sec-Fetch-Site are judged
 * on it; older ones fall back to Origin/Host. A caller with no browser headers has no
 * ambient cookie to abuse, so it is allowed through to the normal session check.
 */
export function isSameOriginPlaygroundRequest(headers: Headers): boolean {
	const site = headers.get("sec-fetch-site");
	if (site) return site === "same-origin" || site === "none";

	const origin = headers.get("origin");
	if (!origin) return true;
	const host = headers.get("host");
	if (!host) return false;
	try {
		return new URL(origin).host === host;
	} catch {
		return false;
	}
}

const PLAYGROUND_API_BASE = "/api/vtc";

export function resolvePlaygroundRequestUrl(rawUrl: string, origin: string): URL {
	const incoming = new URL(rawUrl, origin);
	const path = incoming.pathname.replace(/\/+$/, "") || "/";
	const isOpenApi = path === "/api/openapi" || path.startsWith("/api/openapi/");
	const isPlaygroundApi = path === PLAYGROUND_API_BASE || path.startsWith(`${PLAYGROUND_API_BASE}/`);
	const pathname = isOpenApi || isPlaygroundApi ? path : `${PLAYGROUND_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
	return new URL(`${pathname}${incoming.search}${incoming.hash}`, origin);
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

const SEMESTER_PARAMETER = {
	name: "semester",
	in: "query",
	required: false,
	description: "Optional semester filter, 1-9.",
	schema: { type: "integer", minimum: 1, maximum: 9 },
} as const;

const LIMIT_PARAMETER = {
	name: "limit",
	in: "query",
	required: false,
	description: "Maximum rows to return, 1-1000. Defaults to 200.",
	schema: { type: "integer", minimum: 1, maximum: 1000 },
} as const;

/**
 * Reads straight from MongoDB rather than VTC, so these answer correctly for an account
 * whose stored VTC token is broken or belongs to someone else.
 */
function storedDataPaths(): Record<string, unknown> {
	return {
		"/db/account": {
			get: {
				tags: ["Stored data (owner)"],
				summary: "Account summary from the database",
				description:
					"vtcStudentId, lastSync, locale, whether a VTC token is stored, and how many stored events and attendance rows the account has.",
				operationId: "getStoredAccount",
				responses: { "200": { description: "Account summary" } },
			},
		},
		"/db/user": {
			get: {
				tags: ["Stored data (owner)"],
				summary: "Stored user document",
				description: "The users row with vtcToken, password and calendarShareToken removed.",
				operationId: "getStoredUser",
				responses: { "200": { description: "User document without secrets" } },
			},
		},
		"/db/events": {
			get: {
				tags: ["Stored data (owner)"],
				summary: "Stored timetable events",
				description: "Event rows for the account's vtcStudentId, oldest first.",
				operationId: "getStoredEvents",
				parameters: [SEMESTER_PARAMETER, LIMIT_PARAMETER],
				responses: { "200": { description: "Stored events" } },
			},
		},
		"/db/attendance": {
			get: {
				tags: ["Stored data (owner)"],
				summary: "Stored attendance",
				description: "Attendance rows for the account's vtcStudentId, with per-course class records.",
				operationId: "getStoredAttendance",
				parameters: [SEMESTER_PARAMETER, LIMIT_PARAMETER],
				responses: { "200": { description: "Stored attendance" } },
			},
		},
	};
}

function ownerPaths(): Record<string, unknown> {
	return {
		"/ecard/register": {
			get: {
				tags: ["E-card (owner)"],
				summary: "Register an e-card session",
				description:
					"Uses the stored VTC token. If deviceId is omitted, the server sends a dummy uppercase UUID (same style as the VTC app). Photos are stripped.",
				operationId: "registerEcard",
				parameters: [deviceIdParameter()],
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
					deviceIdParameter(),
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

const TARGET_DISCORD_ID_PARAMETER = {
	name: "discordId",
	in: "query",
	required: false,
	description:
		"Owner only. Run this call against another account's stored VTC token instead of your own. Leave empty to use your own token.",
	schema: { type: "string", pattern: "^\d{17,20}$" },
} as const;

/** Adds the owner-only account switch to every operation of every path. */
function withTargetDiscordId(paths: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [path, item] of Object.entries(paths)) {
		const operations = item as Record<string, Record<string, unknown>>;
		const nextItem: Record<string, unknown> = {};
		for (const [method, operation] of Object.entries(operations)) {
			const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
			nextItem[method] = { ...operation, parameters: [...parameters, TARGET_DISCORD_ID_PARAMETER] };
		}
		out[path] = nextItem;
	}
	return out;
}

export function buildOpenApiDocument(options: { isOwner: boolean }): Record<string, unknown> {
	return {
		openapi: "3.1.0",
		info: {
			title: "VTC student APIs",
			version: "1.0.0",
			description:
				"Try VTC mobile API calls with the token stored on your signed-in account. The token is attached on the server and must not be pasted here.",
		},
		servers: [{ url: PLAYGROUND_API_BASE, description: "This site (stored VTC token)" }],
		tags: options.isOwner
			? [
					{ name: "Account" },
					{ name: "Timetable" },
					{ name: "Attendance" },
					{ name: "E-card (owner)" },
					{ name: "Stored data (owner)" },
				]
			: [{ name: "Account" }, { name: "Timetable" }, { name: "Attendance" }],
		paths: options.isOwner
			? withTargetDiscordId({
					...classPaths(),
					...ownerPaths(),
					...storedDataPaths(),
				})
			: classPaths(),
	};
}
