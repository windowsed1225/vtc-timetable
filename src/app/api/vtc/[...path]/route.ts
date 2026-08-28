import { getAuthenticatedUser } from "@/lib/authenticated-user";
import {
	isOwnerOnlyOp,
	isPlaygroundOwner,
	parseIsPlural,
	parseMonthYear,
	parsePlaygroundPath,
	stripPhotoStr,
	type PlaygroundOp,
} from "@/lib/vtc-playground";
import { NextResponse } from "next/server";
import { API } from "../../../../../vtc-api/src/core/api";

type RouteContext = { params: Promise<{ path: string[] }> };

async function authorize(op: PlaygroundOp) {
	const user = await getAuthenticatedUser();
	if (!user) {
		return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
	}
	if (!user.vtcToken) {
		return { error: NextResponse.json({ error: "No stored VTC token. Sync your timetable first." }, { status: 403 }) };
	}
	if (isOwnerOnlyOp(op.kind) && !isPlaygroundOwner(user.discordId)) {
		return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
	}
	return { api: new API({ token: user.vtcToken }) };
}

function json(data: unknown, status = 200) {
	return NextResponse.json(stripPhotoStr(data), { status });
}

function optionalDeviceId(url: URL): string | undefined {
	const value = url.searchParams.get("deviceId")?.trim();
	return value || undefined;
}

async function dispatch(op: PlaygroundOp, request: Request, api: API) {
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
			return json(await api.refreshEcardToken(refreshToken));
		}
	}
}

async function handle(request: Request, context: RouteContext) {
	const { path } = await context.params;
	const op = parsePlaygroundPath(request.method, path ?? []);
	if (!op) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const authz = await authorize(op);
	if ("error" in authz) return authz.error;

	try {
		return await dispatch(op, request, authz.api);
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
