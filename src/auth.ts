import { headers } from "next/headers";
import { auth as betterAuth } from "@/lib/auth";

/**
 * Compatibility shim preserving the next-auth `auth()` call signature used across
 * the server actions and route handlers. Returns a session-like object whose
 * `user.discordId` is the key the rest of the app reads. Backed by better-auth.
 */
export async function auth() {
	const session = await betterAuth.api.getSession({ headers: await headers() });
	if (!session) return null;

	return {
		user: {
			id: session.user.id,
			name: session.user.name ?? null,
			email: session.user.email ?? null,
			image: session.user.image ?? null,
			discordId: session.user.discordId ?? null,
			vtcStudentId: session.user.vtcStudentId ?? null,
			locale: session.user.locale ?? null,
		},
	};
}
