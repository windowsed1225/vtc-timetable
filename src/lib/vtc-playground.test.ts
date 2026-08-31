import { describe, expect, test } from "bun:test";
import {
	buildOpenApiDocument,
	ecardSessionKey,
	fillEcardPlaygroundRequest,
	isOwnerOnlyOp,
	isPlaygroundOwner,
	isSameOriginPlaygroundRequest,
	isValidTargetDiscordId,
	isStoredDataOp,
	loadEcardDeviceIds,
	mismatchedAccountError,
	parseMonthYear,
	parsePlaygroundPath,
	parseTargetDiscordId,
	rememberEcardPlaygroundSession,
	resolvePlaygroundRequestUrl,
	saveEcardDeviceIds,
	stripPhotoStr,
} from "./vtc-playground";

describe("playground owner gate", () => {
	test("matches a trimmed OWNER_DISCORD_ID", () => {
		expect(isPlaygroundOwner("123", "123")).toBe(true);
		expect(isPlaygroundOwner("123", " 123 ")).toBe(true);
	});

	test("rejects everyone when the owner id is unset", () => {
		expect(isPlaygroundOwner("123", undefined)).toBe(false);
		expect(isPlaygroundOwner("123", "")).toBe(false);
	});

	test("rejects a different Discord id", () => {
		expect(isPlaygroundOwner("123", "456")).toBe(false);
	});
});

describe("playground paths", () => {
	test("maps class-data routes", () => {
		expect(parsePlaygroundPath("GET", ["check-access-token"])).toEqual({ kind: "check-access-token" });
		expect(parsePlaygroundPath("GET", ["timetable"])).toEqual({ kind: "timetable" });
		expect(parsePlaygroundPath("GET", ["moodle"])).toEqual({ kind: "moodle" });
		expect(parsePlaygroundPath("GET", ["attendance"])).toEqual({ kind: "attendance-list" });
		expect(parsePlaygroundPath("GET", ["attendance", "ITP4506"])).toEqual({
			kind: "attendance-detail",
			courseCode: "ITP4506",
		});
		expect(parsePlaygroundPath("GET", ["print-quota"])).toEqual({ kind: "print-quota" });
	});

	test("maps owner e-card routes", () => {
		expect(parsePlaygroundPath("GET", ["ecard", "register"])).toEqual({ kind: "ecard-register" });
		expect(parsePlaygroundPath("GET", ["ecard"])).toEqual({ kind: "ecard-get" });
		expect(parsePlaygroundPath("POST", ["ecard", "refresh"])).toEqual({ kind: "ecard-refresh" });
		expect(isOwnerOnlyOp("ecard-register")).toBe(true);
		expect(isOwnerOnlyOp("timetable")).toBe(false);
	});

	test("maps stored-data routes", () => {
		expect(parsePlaygroundPath("GET", ["db", "account"])).toEqual({ kind: "db-account" });
		expect(parsePlaygroundPath("GET", ["db", "user"])).toEqual({ kind: "db-user" });
		expect(parsePlaygroundPath("GET", ["db", "events"])).toEqual({ kind: "db-events" });
		expect(parsePlaygroundPath("GET", ["db", "attendance"])).toEqual({ kind: "db-attendance" });
		expect(parsePlaygroundPath("GET", ["db", "secrets"])).toBeNull();
		expect(parsePlaygroundPath("POST", ["db", "user"])).toBeNull();
		expect(isOwnerOnlyOp("db-user")).toBe(true);
		expect(isStoredDataOp("db-user")).toBe(true);
		expect(isStoredDataOp("timetable")).toBe(false);
	});

	test("rejects unknown or unsafe paths", () => {
		expect(parsePlaygroundPath("GET", ["nope"])).toBeNull();
		expect(parsePlaygroundPath("POST", ["timetable"])).toBeNull();
		expect(parsePlaygroundPath("GET", ["attendance", "../etc"])).toBeNull();
		expect(parsePlaygroundPath("GET", ["attendance", "ITP 4506"])).toBeNull();
	});
});

describe("query parsing", () => {
	test("defaults month and year when omitted", () => {
		const parsed = parseMonthYear(new URLSearchParams());
		expect("error" in parsed).toBe(false);
		if ("error" in parsed) return;
		expect(parsed.month).toBeGreaterThanOrEqual(1);
		expect(parsed.month).toBeLessThanOrEqual(12);
	});

	test("rejects out-of-range month", () => {
		expect(parseMonthYear(new URLSearchParams("month=13&year=2026"))).toEqual({
			error: "month must be an integer from 1 to 12",
		});
	});
});

describe("target discordId parsing", () => {
	test("returns null when absent or blank", () => {
		expect(parseTargetDiscordId(new URLSearchParams())).toBeNull();
		expect(parseTargetDiscordId(new URLSearchParams("discordId=  "))).toBeNull();
	});

	test("accepts a snowflake", () => {
		expect(parseTargetDiscordId(new URLSearchParams("discordId=123456789012345678"))).toBe("123456789012345678");
	});

	test("rejects non-snowflake input", () => {
		expect(parseTargetDiscordId(new URLSearchParams("discordId=abc"))).toHaveProperty("error");
		expect(parseTargetDiscordId(new URLSearchParams("discordId=123"))).toHaveProperty("error");
		expect(parseTargetDiscordId(new URLSearchParams("discordId[$ne]=1"))).toBeNull();
	});
});

describe("photo stripping", () => {
	test("removes photoStr at any depth and does not mutate the input", () => {
		const input = {
			payload: { userInfo: { name: "Ada", photoStr: "BASE64" }, nested: [{ photoStr: "x", ok: 1 }] },
		};
		expect(stripPhotoStr(input)).toEqual({
			payload: { userInfo: { name: "Ada" }, nested: [{ ok: 1 }] },
		});
		expect(input.payload.userInfo.photoStr).toBe("BASE64");
	});
});

describe("stripPhotoStr value preservation", () => {
	test("keeps Dates intact instead of flattening them to {}", () => {
		const when = new Date("2026-08-31T07:39:00.000Z");
		const out = stripPhotoStr({ lastSync: when, nested: { photoStr: "BASE64", keep: 1 } }) as Record<string, unknown>;
		expect(out.lastSync).toBe(when);
		expect(JSON.stringify(out)).toContain("2026-08-31T07:39:00.000Z");
		expect(out.nested).toEqual({ keep: 1 });
	});
});

describe("OpenAPI document", () => {
	test("omits e-card paths for normal visitors", () => {
		const spec = buildOpenApiDocument({ isOwner: false });
		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/timetable"]).toBeDefined();
		expect(paths["/ecard"]).toBeUndefined();
		expect(paths["/ecard/register"]).toBeUndefined();
	});

	test("includes e-card paths for the owner", () => {
		const spec = buildOpenApiDocument({ isOwner: true });
		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/ecard"]).toBeDefined();
		expect(paths["/ecard/register"]).toBeDefined();
		expect(JSON.stringify(paths["/ecard"])).not.toMatch(/"photoStr"/);
		expect(JSON.stringify(paths["/ecard"])).toContain('"required":false');
	});

	test("never prefills a shared deviceId, which would bind every account to one card", () => {
		const spec = buildOpenApiDocument({ isOwner: true });
		const paths = spec.paths as Record<string, Record<string, { parameters?: { name: string; schema?: Record<string, unknown>; example?: unknown }[] }>>;
		const deviceId = paths["/ecard/register"].get.parameters?.find((parameter) => parameter.name === "deviceId");
		expect(deviceId).toBeDefined();
		expect(deviceId?.example).toBeUndefined();
		expect(deviceId?.schema?.default).toBeUndefined();
		expect(deviceId?.schema?.example).toBeUndefined();
	});

	test("offers stored-data paths to the owner and hides them otherwise", () => {
		const owner = buildOpenApiDocument({ isOwner: true }).paths as Record<string, unknown>;
		expect(owner["/db/account"]).toBeDefined();
		expect(owner["/db/events"]).toBeDefined();
		const visitor = buildOpenApiDocument({ isOwner: false }).paths as Record<string, unknown>;
		expect(visitor["/db/account"]).toBeUndefined();
	});

	test("exposes the account switch only to the owner", () => {
		const ownerSpec = buildOpenApiDocument({ isOwner: true });
		const ownerPaths = ownerSpec.paths as Record<string, Record<string, { parameters?: { name: string }[] }>>;
		for (const item of Object.values(ownerPaths)) {
			for (const operation of Object.values(item)) {
				expect(operation.parameters?.some((parameter) => parameter.name === "discordId")).toBe(true);
			}
		}

		const visitorSpec = buildOpenApiDocument({ isOwner: false });
		expect(JSON.stringify(visitorSpec.paths)).not.toContain("discordId");
	});

	test("keeps existing operation parameters when adding the account switch", () => {
		const spec = buildOpenApiDocument({ isOwner: true });
		const paths = spec.paths as Record<string, Record<string, { parameters?: { name: string }[] }>>;
		const names = paths["/moodle"].get.parameters?.map((parameter) => parameter.name);
		expect(names).toEqual(["month", "year", "isPlural", "discordId"]);
	});

	test("uses a same-origin relative server so reverse proxies cannot poison the Try-it host", () => {
		const spec = buildOpenApiDocument({ isOwner: false });
		const servers = spec.servers as { url: string }[];
		expect(servers).toEqual([{ url: "/api/vtc", description: "This site (stored VTC token)" }]);
	});
});

describe("playground request URL", () => {
	const origin = "https://example.com";

	test("prefixes Scalar operation paths that omitted /api/vtc", () => {
		const url = resolvePlaygroundRequestUrl("/ecard/register?deviceId=DEV-1", origin);
		expect(url.origin).toBe(origin);
		expect(url.pathname).toBe("/api/vtc/ecard/register");
		expect(url.searchParams.get("deviceId")).toBe("DEV-1");
	});

	test("leaves already-prefixed playground paths and the OpenAPI document alone", () => {
		expect(resolvePlaygroundRequestUrl("/api/vtc/timetable", origin).pathname).toBe("/api/vtc/timetable");
		expect(resolvePlaygroundRequestUrl("/api/openapi", origin).pathname).toBe("/api/openapi");
	});

	test("rewrites a reverse-proxy internal origin onto the page origin", () => {
		const url = resolvePlaygroundRequestUrl("http://127.0.0.1:3000/api/vtc/ecard/register", origin);
		expect(url.origin).toBe(origin);
		expect(url.pathname).toBe("/api/vtc/ecard/register");
	});
});

describe("cross-account identity check", () => {
	test("rejects a stored token that authenticates as someone else", () => {
		expect(mismatchedAccountError("260083743", "260083349")).toContain("260083349");
		expect(mismatchedAccountError("260083743", "260083349")).toContain("260083743");
	});

	test("allows a token that matches the account it is stored on", () => {
		expect(mismatchedAccountError("260083743", "260083743")).toBeNull();
	});

	test("cannot judge an account that never recorded a student id", () => {
		expect(mismatchedAccountError(null, "260083349")).toBeNull();
	});
});

describe("account switch input", () => {
	test("accepts a snowflake with surrounding whitespace", () => {
		expect(isValidTargetDiscordId("527400569053118474")).toBe(true);
		expect(isValidTargetDiscordId("  527400569053118474  ")).toBe(true);
	});

	test("rejects anything that is not a 17-20 digit id", () => {
		expect(isValidTargetDiscordId("")).toBe(false);
		expect(isValidTargetDiscordId("abc")).toBe(false);
		expect(isValidTargetDiscordId("12345")).toBe(false);
		expect(isValidTargetDiscordId("527400569053118474x")).toBe(false);
	});
});

describe("same-origin guard", () => {
	const headers = (init: Record<string, string>) => new Headers(init);

	test("allows same-origin fetches and user-initiated navigation", () => {
		expect(isSameOriginPlaygroundRequest(headers({ "sec-fetch-site": "same-origin" }))).toBe(true);
		expect(isSameOriginPlaygroundRequest(headers({ "sec-fetch-site": "none" }))).toBe(true);
	});

	test("rejects cross-site requests that still carry the SameSite=Lax cookie", () => {
		expect(isSameOriginPlaygroundRequest(headers({ "sec-fetch-site": "cross-site" }))).toBe(false);
		expect(isSameOriginPlaygroundRequest(headers({ "sec-fetch-site": "same-site" }))).toBe(false);
	});

	test("falls back to Origin against Host when Sec-Fetch-Site is absent", () => {
		expect(
			isSameOriginPlaygroundRequest(headers({ origin: "https://vtc.example.me", host: "vtc.example.me" })),
		).toBe(true);
		expect(
			isSameOriginPlaygroundRequest(headers({ origin: "https://evil.example", host: "vtc.example.me" })),
		).toBe(false);
		expect(isSameOriginPlaygroundRequest(headers({ origin: "not a url", host: "vtc.example.me" }))).toBe(false);
	});

	test("lets non-browser callers through to the session check", () => {
		expect(isSameOriginPlaygroundRequest(headers({}))).toBe(true);
	});
});

describe("ecard session key", () => {
	test("separates each target account from the caller's own session", () => {
		expect(ecardSessionKey(new URL("https://example.com/api/vtc/ecard"))).toBe("");
		expect(ecardSessionKey(new URL("https://example.com/api/vtc/ecard?discordId=527400569053118474"))).toBe(
			"527400569053118474",
		);
	});

	test("gives each account its own device UUID and its own e-card session", () => {
		const sessions = new Map([["", { accessToken: "OWN-JWT", deviceId: "OWN-DEVICE" }]]);
		const other = new URL("https://example.com/api/vtc/ecard/register?discordId=527400569053118474");
		const key = ecardSessionKey(other);
		const filled = fillEcardPlaygroundRequest(other, undefined, sessions.get(key) ?? {}, "FRESH-DEVICE");
		expect(filled.url.searchParams.get("deviceId")).toBe("FRESH-DEVICE");
	});

	test("never replays a remembered access token onto another account's request", () => {
		const own = { accessToken: "OWN-JWT", refreshToken: "OWN-REFRESH", deviceId: "DEV-1" };
		const sessions = new Map([[ecardSessionKey(new URL("https://example.com/api/vtc/ecard")), own]]);

		const other = new URL("https://example.com/api/vtc/ecard?discordId=527400569053118474");
		const filled = fillEcardPlaygroundRequest(
			other,
			undefined,
			sessions.get(ecardSessionKey(other)) ?? {},
			"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
		);
		expect(filled.url.searchParams.get("accessToken")).toBeNull();
		expect(filled.url.searchParams.get("discordId")).toBe("527400569053118474");
	});
});

describe("ecard device id storage", () => {
	function fakeStorage(initial?: string) {
		let value = initial ?? null;
		return {
			getItem: () => value,
			setItem: (_key: string, next: string) => {
				value = next;
			},
			read: () => value,
		};
	}

	test("keeps each account's device id across reloads", () => {
		const storage = fakeStorage();
		saveEcardDeviceIds(storage, new Map([["", "DEV-OWN"], ["527400569053118474", "DEV-OTHER"]]));
		const loaded = loadEcardDeviceIds(storage);
		expect(loaded.get("")).toBe("DEV-OWN");
		expect(loaded.get("527400569053118474")).toBe("DEV-OTHER");
	});

	test("ignores junk and unavailable storage instead of throwing", () => {
		expect(loadEcardDeviceIds(undefined).size).toBe(0);
		expect(loadEcardDeviceIds(fakeStorage("not json")).size).toBe(0);
		expect(loadEcardDeviceIds(fakeStorage('["DEV-1"]')).size).toBe(0);
		expect(loadEcardDeviceIds(fakeStorage('{"":"","a":1,"b":"DEV-1"}')).size).toBe(1);
		expect(() =>
			saveEcardDeviceIds(
				{
					getItem: () => null,
					setItem: () => {
						throw new Error("blocked");
					},
				},
				new Map([["", "DEV-1"]]),
			),
		).not.toThrow();
	});
});

describe("ecard playground auto-paste", () => {
	const dummy = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";

	test("remembers device and tokens from a register payload", () => {
		const session = rememberEcardPlaygroundSession({
			deviceId: "DEV-1",
			payload: { accessToken: "acc", refreshToken: "ref" },
		});
		expect(session).toEqual({ deviceId: "DEV-1", accessToken: "acc", refreshToken: "ref" });
	});

	test("fills a dummy deviceId and last accessToken", () => {
		const filled = fillEcardPlaygroundRequest(
			new URL("https://example.com/api/vtc/ecard"),
			undefined,
			{ accessToken: "acc", deviceId: "DEV-1" },
			dummy,
		);
		expect(filled.url.searchParams.get("deviceId")).toBe("DEV-1");
		expect(filled.url.searchParams.get("accessToken")).toBe("acc");
	});

	test("pastes refreshToken into an empty refresh body", () => {
		const filled = fillEcardPlaygroundRequest(
			new URL("https://example.com/api/vtc/ecard/refresh"),
			{ method: "POST", body: "{}" },
			{ refreshToken: "ref" },
			dummy,
		);
		expect(JSON.parse(String(filled.init?.body))).toEqual({ refreshToken: "ref" });
	});
});
