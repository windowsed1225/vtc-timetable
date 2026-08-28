import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { buildOpenApiDocument, dummyEcardDeviceId, isPlaygroundOwner } from "@/lib/vtc-playground";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
	const user = await getAuthenticatedUser();
	if (!user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	const origin = new URL(request.url).origin;
	return NextResponse.json(
		buildOpenApiDocument({
			isOwner: isPlaygroundOwner(user.discordId),
			origin,
			dummyDeviceId: dummyEcardDeviceId(),
		}),
	);
}
