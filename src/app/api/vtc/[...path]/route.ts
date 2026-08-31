import { getAuthenticatedUser, getVtcAccountByDiscordId } from "@/lib/authenticated-user";
import {
	getStoredAccount,
	getStoredAttendance,
	getStoredEvents,
	getStoredUser,
	parseStoredLimit,
	parseStoredSemester,
} from "@/lib/playground-stored-data";
import {
	isOwnerOnlyOp,
	isPlaygroundOwner,
	isSameOriginPlaygroundRequest,
	isStoredDataOp,
	mismatchedAccountError,
	parseIsPlural,
	parseMonthYear,
	parsePlaygroundPath,
	parseTargetDiscordId,
	stripPhotoStr,
	type PlaygroundOp,
} from "@/lib/vtc-playground";
import { NextResponse } from "next/server";
import { API } from "../../../../../vtc-api/src/core/api";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Stored-data reads never touch VTC, so they resolve a subject account instead of a token.
 * That is the point: an account whose stored token was corrupted still has correct rows.
 */
async function authorizeStoredData(url: URL) {
	const user = await getAuthenticatedUser();
	if (!user) {
		return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
	}
	if (!isPlaygroundOwner(user.discordId)) {
		return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
	}
	const target = parseTargetDiscordId(url.searchParams);
	if (target && typeof target === "object") {
		return { error: NextResponse.json({ error: target.error }, { status: 400 }) };
	}
	return { discordId: target ?? user.discordId };
}

async function dispatchStoredData(op: PlaygroundOp, url: URL, discordId: string) {
	const notFound = NextResponse.json({ error: "No account with that Discord ID" }, { status: 404 });

	if (op.kind === "db-account") {
		const account = await getStoredAccount(discordId);
		return account ? json(account) : notFound;
	}
	if (op.kind === "db-user") {
		const user = await getStoredUser(discordId);
		return user ? json(user) : notFound;
	}

	const semester = parseStoredSemester(url.searchParams);
	if (semester && typeof semester === "object") {
		return NextResponse.json({ error: semester.error }, { status: 400 });
	}
	const limit = parseStoredLimit(url.searchParams);
	if (typeof limit !== "number") {
		return NextResponse.json({ error: limit.error }, { status: 400 });
	}

	const rows =
		op.kind === "db-events"
			? await getStoredEvents(discordId, { semester, limit })
			: await getStoredAttendance(discordId, { semester, limit });
	return rows ? json(rows) : notFound;
}

async function authorize(op: PlaygroundOp, url: URL) {
	const user = await getAuthenticatedUser();
	if (!user) {
		return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
	}
	const isOwner = isPlaygroundOwner(user.discordId);
	if (isOwnerOnlyOp(op.kind) && !isOwner) {
		return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
	}

	const target = parseTargetDiscordId(url.searchParams);
	if (target && typeof target === "object") {
		return { error: NextResponse.json({ error: target.error }, { status: 400 }) };
	}
	if (target && target !== user.discordId) {
		if (!isOwner) {
			return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
		}
		const account = await getVtcAccountByDiscordId(target);
		if (!account) {
			return { error: NextResponse.json({ error: "No account with that Discord ID" }, { status: 404 }) };
		}
		if (!account.vtcToken) {
			return { error: NextResponse.json({ error: "That account has no stored VTC token" }, { status: 409 }) };
		}

		const api = new API({ token: account.vtcToken });
		const identity = await api.checkAccessToken();
		if (!identity.isSuccess) {
			return {
				error: NextResponse.json({ error: "That account's stored VTC token is no longer valid" }, { status: 409 }),
			};
		}
		const mismatch = mismatchedAccountError(account.vtcStudentId, identity.payload.vtcID);
		if (mismatch) {
			return { error: NextResponse.json({ error: mismatch }, { status: 409 }) };
		}
		return { api, isCrossAccount: true, discordId: target };
	}

	if (!user.vtcToken) {
		return { error: NextResponse.json({ error: "No stored VTC token. Sync your timetable first." }, { status: 403 }) };
	}
	return { api: new API({ token: user.vtcToken }), isCrossAccount: false, discordId: user.discordId };
}

/**
 * Says which account answered the request, and what the server saw in the query string.
 * Without this the caller cannot tell a dropped discordId from a wrong upstream response.
 */
function stampAccount(response: NextResponse, discordId: string, url: URL): NextResponse {
	response.headers.set("X-VTC-Account", discordId);
	response.headers.set("X-VTC-Requested-Account", url.searchParams.get("discordId") ?? "(none sent)");
	return response;
}

function json(data: unknown, status = 200) {
	return NextResponse.json(stripPhotoStr(data), { status });
}

/** E-card JWTs authenticate the cardholder, so one issued for you would silently win over discordId. */
function crossAccountTokenError(field: "accessToken" | "refreshToken"): string {
	return `${field} identifies the cardholder it was issued to, so it cannot be combined with discordId. Omit it to use the target account's stored VTC token.`;
}

function optionalDeviceId(url: URL): string | undefined {
	const value = url.searchParams.get("deviceId")?.trim();
	return value || undefined;
}

async function dispatch(op: PlaygroundOp, request: Request, api: API, isCrossAccount: boolean) {
	const url = new URL(request.url);

	switch (op.kind) {
		case "check-access-token":
			return json(await api.checkAccessToken());
		case "timetable": {
			const parsed = parseMonthYear(url.searchParams);
			if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
			return json(await api.getTimeTableAndReminderList(parsed.month, parsed.year));
		}
		case "moodle": {
			const parsed = parseMonthYear(url.searchParams);
			if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
			const isPlural = parseIsPlural(url.searchParams);
			if (typeof isPlural !== "number") return NextResponse.json({ error: isPlural.error }, { status: 400 });
			return json(await api.getMoodleTimetable(isPlural, parsed.month, parsed.year));
		}
		case "attendance-list":
			return json(await api.getClassAttendanceList());
		case "attendance-detail":
			return json(await api.getClassAttendanceDetail(op.courseCode));
		case "print-quota":
			return json(await api.getPrintQuota());
		case "ecard-register":
			return json(await api.registerEcard(optionalDeviceId(url)));
		case "ecard-get": {
			const accessToken = url.searchParams.get("accessToken")?.trim();
			if (accessToken && isCrossAccount) {
				return NextResponse.json({ error: crossAccountTokenError("accessToken") }, { status: 400 });
			}
			if (accessToken) {
				return json(await api.getEcard(accessToken));
			}
			const registered = await api.registerEcard(optionalDeviceId(url));
			if (!registered.isSuccess || !registered.payload?.accessToken) {
				return json(registered);
			}
			const card = await api.getEcard(registered.payload.accessToken);
			return json({
				...card,
				deviceId: registered.deviceId,
			});
		}
		case "ecard-refresh": {
			let body: unknown;
			try {
				body = await request.json();
			} catch {
				return NextResponse.json({ error: "JSON body required" }, { status: 400 });
			}
			const refreshToken =
				body && typeof body === "object" && "refreshToken" in body && typeof body.refreshToken === "string"
					? body.refreshToken.trim()
					: "";
			if (!refreshToken) {
				return NextResponse.json({ error: "refreshToken is required" }, { status: 400 });
			}
			if (isCrossAccount) {
				return NextResponse.json({ error: crossAccountTokenError("refreshToken") }, { status: 400 });
			}
			return json(await api.refreshEcardToken(refreshToken));
		}
		default:
			// Stored-data ops are handled before this point; anything else is a routing mistake,
			// and returning undefined here would surface as an opaque runtime error.
			return NextResponse.json({ error: "Unsupported operation" }, { status: 500 });
	}
}

async function handle(request: Request, context: RouteContext) {
	const { path } = await context.params;
	const op = parsePlaygroundPath(request.method, path ?? []);
	if (!op) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	if (!isSameOriginPlaygroundRequest(request.headers)) {
		return NextResponse.json({ error: "Cross-site requests are not allowed" }, { status: 403 });
	}

	const url = new URL(request.url);
	if (isStoredDataOp(op.kind)) {
		const stored = await authorizeStoredData(url);
		if ("error" in stored) return stored.error;
		try {
			return stampAccount(await dispatchStoredData(op, url, stored.discordId), stored.discordId, url);
		} catch (error) {
			console.error("vtc playground stored read failed", {
				name: error instanceof Error ? error.name : "Error",
				op: op.kind,
			});
			// Owner-only surface, so surface the reason instead of a blank 500.
			return NextResponse.json(
				{
					error: "Stored data lookup failed",
					detail: error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error",
				},
				{ status: 500 },
			);
		}
	}

	const authz = await authorize(op, url);
	if ("error" in authz) return authz.error;

	try {
		return stampAccount(
			await dispatch(op, request, authz.api, authz.isCrossAccount),
			authz.discordId,
			url,
		);
	} catch (error) {
		console.error("vtc playground failed", { name: error instanceof Error ? error.name : "Error", op: op.kind });
		return NextResponse.json({ error: "VTC request failed" }, { status: 502 });
	}
}

export function GET(request: Request, context: RouteContext) {
	return handle(request, context);
}

export function POST(request: Request, context: RouteContext) {
	return handle(request, context);
}
