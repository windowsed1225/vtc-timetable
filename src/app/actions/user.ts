"use server";

import { auth } from "@/auth";
import connectDB from "@/lib/db";
import User from "@/models/User";
import type { EcardUserInfo } from "../../../vtc-api/src/types/ecardRegister";
import type { PrintQuotaPayload } from "../../../vtc-api/src/types/getPrintQuota";
import { API } from "../../../vtc-api/src/core/api";

/**
 * Validate the stored VTC access token.
 * Called on page load to detect expired tokens early.
 *
 * Returns:
 *  { valid: true, site? }                 – token is still active; site from checkAccessToken payload
 *  { valid: false, reason: "no_token" }   – user never synced (silent, no popup)
 *  { valid: false, reason: "expired" }    – token is expired / invalid
 */
export async function checkStoredToken(): Promise<{
	valid: boolean;
	reason?: "no_token" | "expired";
	/** Campus / site code from VTC checkAccessToken (e.g. "HKIIT-KT") when valid */
	site?: string;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) {
			return { valid: false, reason: "no_token" };
		}

		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();

		if (!user?.vtcToken) {
			return { valid: false, reason: "no_token" };
		}

		const api = new API({ token: user.vtcToken });
		const result = await api.checkAccessToken();

		if (result.isSuccess) {
			return {
				valid: true,
				site: result.payload?.site || undefined,
			};
		}

		return { valid: false, reason: "expired" };
	} catch (error) {
		console.error("Error checking stored token:", error);
		// On network / server error, don't falsely flag as expired
		return { valid: true };
	}
}

/**
 * Fetch campus print quota via VTC `getPrintQuota` using the stored token.
 * Does not persist the result — always live from VTC.
 */
export async function getPrintQuota(): Promise<{
	success: boolean;
	data?: PrintQuotaPayload;
	error?: string;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Not authenticated" };
		}

		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();
		if (!user?.vtcToken) {
			return { success: false, error: "No stored VTC token found. Please sync with your URL first." };
		}

		const api = new API({ token: user.vtcToken });
		const result = await api.getPrintQuota();

		if (!result.isSuccess || !result.payload) {
			return {
				success: false,
				error: result.errorMsg || "Failed to fetch print quota. Your VTC token may have expired.",
			};
		}

		return {
			success: true,
			data: {
				campus: result.payload.campus,
				balance: result.payload.balance,
				status: result.payload.status,
				lastUpdatedTime: result.payload.lastUpdatedTime,
			},
		};
	} catch (error) {
		console.error("Error fetching print quota:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch print quota",
		};
	}
}

/**
 * Register an ecard session via ecard-api.vtc.edu.hk using the stored VTC token.
 * Sends a random deviceID each call (VTC app style).
 *
 * By default omits the large base64 student photo (`photoStr`) from the result.
 * Pass `{ includePhoto: true }` to keep it.
 */
export async function registerEcard(options?: {
	includePhoto?: boolean;
	deviceId?: string;
}): Promise<{
	success: boolean;
	data?: {
		deviceId: string;
		isRegistered: boolean;
		isAcceptTnC: boolean;
		accessToken: string;
		refreshToken: string;
		expire: string;
		userInfo: Omit<EcardUserInfo, "photoStr"> & { photoStr?: string };
	};
	error?: string;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Not authenticated" };
		}

		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).lean();
		if (!user?.vtcToken) {
			return { success: false, error: "No stored VTC token found. Please sync with your URL first." };
		}

		const api = new API({ token: user.vtcToken });
		const result = await api.registerEcard(options?.deviceId);

		if (!result.isSuccess || !result.payload) {
			return {
				success: false,
				error: "Failed to register ecard session. Your VTC token may have expired.",
			};
		}

		const { photoStr, ...userInfoRest } = result.payload.userInfo;
		const userInfo = options?.includePhoto
			? { ...userInfoRest, photoStr }
			: userInfoRest;

		return {
			success: true,
			data: {
				deviceId: result.deviceId,
				isRegistered: result.payload.isRegistered,
				isAcceptTnC: result.payload.isAcceptTnC,
				accessToken: result.payload.accessToken,
				refreshToken: result.payload.refreshToken,
				expire: result.payload.expire,
				userInfo,
			},
		};
	} catch (error) {
		console.error("Error registering ecard:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to register ecard",
		};
	}
}

/**
 * Save user preferred locale to the database
 * Called when the user switches language in the UI
 */
export async function saveUserLocale(locale: "en" | "zh-HK"): Promise<{
	success: boolean;
	error?: string;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Not authenticated" };
		}

		await connectDB();
		await User.findOneAndUpdate({ discordId: session.user.discordId }, { locale }, { upsert: false });

		return { success: true };
	} catch (error) {
		console.error("Error saving user locale:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to save locale",
		};
	}
}
