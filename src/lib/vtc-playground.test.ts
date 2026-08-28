import { describe, expect, test } from "bun:test";
import {
	buildOpenApiDocument,
	fillEcardPlaygroundRequest,
	isOwnerOnlyOp,
	isPlaygroundOwner,
	parseMonthYear,
	parsePlaygroundPath,
	rememberEcardPlaygroundSession,
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

describe("OpenAPI document", () => {
	test("omits e-card paths for normal visitors", () => {
		const spec = buildOpenApiDocument({ isOwner: false, origin: "https://example.com" });
		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/timetable"]).toBeDefined();
		expect(paths["/ecard"]).toBeUndefined();
		expect(paths["/ecard/register"]).toBeUndefined();
	});

	test("includes e-card paths for the owner", () => {
		const spec = buildOpenApiDocument({
			isOwner: true,
			origin: "https://example.com",
			dummyDeviceId: "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",
		});
		const paths = spec.paths as Record<string, unknown>;
		expect(paths["/ecard"]).toBeDefined();
		expect(paths["/ecard/register"]).toBeDefined();
		expect(JSON.stringify(paths["/ecard"])).not.toMatch(/"photoStr"/);
		expect(JSON.stringify(paths["/ecard/register"])).toContain("dummy");
		expect(JSON.stringify(paths["/ecard"])).toContain('"required":false');
		expect(JSON.stringify(paths["/ecard/register"])).toContain("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA");
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
