"use server";

import { auth } from "@/auth";
import connectDB from "@/lib/db";
import Attendance from "@/models/Attendance";
import Event from "@/models/Event";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

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
        const existingUser = await User.findOne({ email, discordId: { $ne: session.user.discordId } }).lean();
        if (existingUser) {
            return { success: false, error: "Email already in use by another account." };
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user
        const user = await User.findOne({ discordId: session.user.discordId });
        if (!user) {
            return { success: false, error: "User not found." };
        }

        user.email = email;
        user.password = hashedPassword;

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
    };
    error?: string;
}> {
    try {
        const session = await auth();
        if (!session?.user?.discordId) {
            return { success: false, error: "Please sign in first." };
        }

        await connectDB();

        const user = await User.findOne({ discordId: session.user.discordId }).lean();
        if (!user) {
            return { success: false, error: "User not found." };
        }

        return {
            success: true,
            data: {
                email: user.email,
                hasPassword: !!user.password,
                authProviders: user.authProvider || ["discord"],
                discordUsername: user.discordUsername,
                vtcStudentId: user.vtcStudentId,
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
        const user = await User.findOne({ discordId: session.user.discordId }).lean();
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
