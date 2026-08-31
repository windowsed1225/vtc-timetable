import SharedCalendarOgImage from "@/components/SharedCalendarOgImage";
import { auth } from "@/auth";
import { isValidDiscordId, normalizeCalendarShareMonth, normalizeCalendarShareView } from "@/lib/calendar-share";
import { loadOwnerCalendar, loadSharedCalendar } from "@/lib/load-shared-calendar";
import type { NextRequest } from "next/server";
import { ImageResponse } from "takumi-js/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ token: string }> },
) {
	const { token } = await params;
	const view = normalizeCalendarShareView(request.nextUrl.searchParams.get("view"));
	const month = view === "month" ? normalizeCalendarShareMonth(request.nextUrl.searchParams.get("month")) : null;
	let shared = await loadSharedCalendar(token, view, month);
	if (!shared && isValidDiscordId(token)) {
		const session = await auth();
		if (session?.user?.discordId) {
			shared = await loadOwnerCalendar(token, view, session.user.discordId, month);
		}
	}
	if (!shared) return new Response("Shared calendar not found", { status: 404 });

	return new ImageResponse(
		<SharedCalendarOgImage events={shared.events} view={view} month={month} />,
		{
			width: 1200,
			height: 630,
			headers: {
				"Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
			},
		},
	);
}
