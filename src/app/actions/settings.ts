"use server";

import { auth } from "@/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

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
 * Update user's attendance grace period (in minutes)
 */
export async function updateGracePeriod(
    gracePeriod: number
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth();
        if (!session?.user?.discordId) {
            return { success: false, error: "Please sign in first." };
        }

        await connectDB();

        // Validate grace period range (0-60 minutes)
        if (gracePeriod < 0 || gracePeriod > 60) {
            return { success: false, error: "Grace period must be between 0 and 60 minutes." };
        }

        // Update user
        const user = await User.findOneAndUpdate(
            { discordId: session.user.discordId },
            { attendanceGracePeriod: gracePeriod },
            { new: true }
        );

        if (!user) {
            return { success: false, error: "User not found." };
        }

        return { success: true };
    } catch (error) {
        console.error("Error updating grace period:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update grace period",
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
        attendanceGracePeriod: number;
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
                attendanceGracePeriod: user.attendanceGracePeriod || 10,
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
