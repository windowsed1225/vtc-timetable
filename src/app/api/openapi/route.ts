import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { buildOpenApiDocument, isPlaygroundOwner } from "@/lib/vtc-playground";
import { NextResponse } from "next/server";

export async function GET() {
	const user = await getAuthenticatedUser();
	if (!user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	return NextResponse.json(
		buildOpenApiDocument({ isOwner: isPlaygroundOwner(user.discordId) }),
	);
}
