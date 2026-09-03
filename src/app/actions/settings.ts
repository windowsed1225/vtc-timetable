"use server";

import { auth } from "@/auth";
import { auth as betterAuth } from "@/lib/auth";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import { invalidateUserCaches } from "@/lib/cache";
import connectDB from "@/lib/db";
import {
	DEFAULT_GRACE_PERIOD_THRESHOLD,
	MAX_GRACE_PERIOD_THRESHOLD,
	MIN_GRACE_PERIOD_THRESHOLD,
	parseGracePeriodThreshold,
	resolveGracePeriodThreshold,
	storedGracePeriodOverride,
} from "@/lib/grace-period";
import Attendance from "@/models/Attendance";
import Event from "@/models/Event";
import User from "@/models/User";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

/**
 * Credential sign-in reads the password from better-auth's `account` row, not
 * from `users.password`, so it has to be written through better-auth. An
 * existing row is updated in place because this form resets the password
 * without asking for the current one.
 */
async function writeCredentialPassword(userId: string, password: string): Promise<void> {
    const ctx = await betterAuth.$context;
    const account = await ctx.internalAdapter.findCredentialAccount(userId);
    if (!account) {
        await betterAuth.api.setPassword({ body: { newPassword: password }, headers: await headers() });
        return;
    }
    await ctx.internalAdapter.updateAccount(account.id, {
        password: await ctx.password.hash(password),
    });
}

/**
 * Update user's email and password for credentials-based login
 */
export async function updateEmailPassword(
    email: string,
    password: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth();
        if (!session?.user?.discordId) {
            return { success: false, error: "Please sign in first." };
        }

        await connectDB();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return { success: false, error: "Invalid email format." };
        }

        // Validate password length
        if (!password || password.length < 8) {
            return { success: false, error: "Password must be at least 8 characters." };
        }

        // Check if email is already used by another user
        const existingUser = await User.findOne({ email, discordId: { $ne: session.user.discordId } }).select("_id").lean();
        if (existingUser) {
            return { success: false, error: "Email already in use by another account." };
        }

        const user = await User.findOne({ discordId: session.user.discordId });
        if (!user) {
            return { success: false, error: "User not found." };
        }

        await writeCredentialPassword(session.user.id, password);

        user.email = email;

        // Add credentials to authProvider array if not already present
        if (!user.authProvider.includes("credentials")) {
            user.authProvider.push("credentials");
        }

        await user.save();

        return { success: true };
    } catch (error) {
        console.error("Error updating email/password:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update email/password",
        };
    }
}


/**
 * Get current user settings
 */
export async function getUserSettings(): Promise<{
    success: boolean;
    data?: {
        email?: string;
        hasPassword: boolean;
        authProviders: string[];
        discordUsername?: string;
        vtcStudentId?: string;
        gracePeriodThreshold: number;
        gracePeriodThresholdOverride: number | null;
        gracePeriodDefault: number;
        gracePeriodMin: number;
        gracePeriodMax: number;
    };
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user?.discordId) {
            return { success: false, error: "Please sign in first." };
        }

        await connectDB();

        const user = await User.findOne({ discordId: session.user.discordId })
            .select("email authProvider discordUsername vtcStudentId gracePeriodThreshold")
            .lean();
        if (!user) {
            return { success: false, error: "User not found." };
        }

        const ctx = await betterAuth.$context;
        const credentialAccount = await ctx.internalAdapter.findCredentialAccount(session.user.id);

        const override = storedGracePeriodOverride(user.gracePeriodThreshold);

        return {
            success: true,
            data: {
                email: user.email,
                hasPassword: Boolean(credentialAccount?.password),
                authProviders: user.authProvider || ["discord"],
                discordUsername: user.discordUsername,
                vtcStudentId: user.vtcStudentId,
                gracePeriodThreshold: resolveGracePeriodThreshold(override),
                gracePeriodThresholdOverride: override,
                gracePeriodDefault: DEFAULT_GRACE_PERIOD_THRESHOLD,
                gracePeriodMin: MIN_GRACE_PERIOD_THRESHOLD,
                gracePeriodMax: MAX_GRACE_PERIOD_THRESHOLD,
            },
        };
    } catch (error) {
        console.error("Error fetching user settings:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to fetch settings",
        };
    }
}

/**
 * Clear all synced VTC data for the signed-in user: every timetable Event and
 * Attendance record. The stored VTC token (API key) and last-sync marker are
 * intentionally kept so the user can re-sync instantly with Quick Sync.
 */
export async function clearVtcData(): Promise<{
    success: boolean;
    deletedEvents?: number;
    deletedAttendance?: number;
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user?.discordId) {
            return { success: false, error: "Not signed in" };
        }

        await connectDB();
        const user = await User.findOne({ discordId: session.user.discordId }).select("vtcStudentId").lean();
        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Scope deletes to this user's VTC student id (how Events/Attendance are keyed).
        const vtcStudentId = user.vtcStudentId;
        let deletedEvents = 0;
        let deletedAttendance = 0;

        if (vtcStudentId) {
            const [eventResult, attendanceResult] = await Promise.all([
                Event.deleteMany({ vtcStudentId }),
                Attendance.deleteMany({ vtcStudentId }),
            ]);
            deletedEvents = eventResult.deletedCount ?? 0;
            deletedAttendance = attendanceResult.deletedCount ?? 0;
        }

        // Keep the stored vtcToken + lastSync so Quick Sync stays available and a
        // recent lastSync prevents auto-sync from immediately re-populating the data.

        if (session.user.id) await invalidateUserCaches(session.user.id);
        revalidatePath("/");
        return { success: true, deletedEvents, deletedAttendance };
    } catch (error) {
        console.error("Error clearing VTC data:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to clear VTC data",
        };
    }
}

export async function updateGracePeriodThreshold(value: unknown): Promise<{
    success: boolean;
    data?: { gracePeriodThreshold: number };
    error?: string;
}> {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return { success: false, error: "Please sign in first." };
        }

        const parsed = parseGracePeriodThreshold(value);
        if (!parsed.ok) {
            return {
                success: false,
                error: parsed.error === "out_of_range"
                    ? "Enter a passing rate between 1 and 100 percent."
                    : "Enter a valid numeric passing rate.",
            };
        }

        await connectDB();
        const updated = await User.findOneAndUpdate(
            { discordId: user.discordId },
            { $set: { gracePeriodThreshold: parsed.value } },
            { returnDocument: "after" },
        );
        if (!updated) {
            return { success: false, error: "User not found." };
        }

        await invalidateUserCaches(user.userId);
        revalidatePath("/");
        revalidatePath("/settings");
        return { success: true, data: { gracePeriodThreshold: parsed.value } };
    } catch (error) {
        console.error("Error updating grace period threshold:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update passing rate",
        };
    }
}

export async function resetGracePeriodThreshold(): Promise<{
    success: boolean;
    data?: { gracePeriodThreshold: number };
    error?: string;
}> {
    try {
        const user = await getAuthenticatedUser();
        if (!user) {
            return { success: false, error: "Please sign in first." };
        }

        await connectDB();
        const updated = await User.findOneAndUpdate(
            { discordId: user.discordId },
            { $unset: { gracePeriodThreshold: 1 } },
            { returnDocument: "after" },
        );
        if (!updated) {
            return { success: false, error: "User not found." };
        }

        await invalidateUserCaches(user.userId);
        revalidatePath("/");
        revalidatePath("/settings");
        return { success: true, data: { gracePeriodThreshold: DEFAULT_GRACE_PERIOD_THRESHOLD } };
    } catch (error) {
        console.error("Error resetting grace period threshold:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to reset passing rate",
        };
    }
}
