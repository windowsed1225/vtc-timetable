import { auth } from "@/auth";
import connectDB from "@/lib/db";
import { resolveGracePeriodThreshold, storedGracePeriodOverride } from "@/lib/grace-period";
import User from "@/models/User";

const USER_FIELDS = "discordId vtcStudentId vtcToken gracePeriodThreshold" as const;

export type AuthenticatedUser = {
	userId: string;
	discordId: string;
	vtcStudentId: string | null;
	vtcToken: string | null;
	gracePeriodThreshold: number;
	gracePeriodThresholdOverride: number | null;
};

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
	const session = await auth();
	if (!session?.user?.id || !session.user.discordId) return null;

	await connectDB();
	const user = await User.findOne({ discordId: session.user.discordId }).select(USER_FIELDS).lean();
	if (!user) return null;

	const override = storedGracePeriodOverride(user.gracePeriodThreshold);

	return {
		userId: session.user.id,
		discordId: session.user.discordId,
		vtcStudentId: user.vtcStudentId ?? null,
		vtcToken: user.vtcToken ?? null,
		gracePeriodThreshold: resolveGracePeriodThreshold(override),
		gracePeriodThresholdOverride: override,
	};
}

/** Owner-only playground lookup: the VTC credentials stored on another account. */
export async function getVtcAccountByDiscordId(
	discordId: string,
): Promise<{ vtcToken: string | null; vtcStudentId: string | null } | null> {
	await connectDB();
	const user = await User.findOne({ discordId }).select("vtcToken vtcStudentId").lean();
	if (!user) return null;
	return { vtcToken: user.vtcToken ?? null, vtcStudentId: user.vtcStudentId ?? null };
}
