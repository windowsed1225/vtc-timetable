"use server";

import { auth } from "@/auth";
import { getAuthenticatedUser } from "@/lib/authenticated-user";
import connectDB from "@/lib/db";
import { loadPrintQuota, loadProgrammeInfo, type ProgrammeInfo } from "@/lib/load-user-data";
import User from "@/models/User";
import { buildStudentCardView, type StudentCardView } from "@/lib/student-card";
import type { EcardUserInfo } from "../../../vtc-api/src/types/ecardRegister";
import type { PrintQuotaPayload } from "../../../vtc-api/src/types/getPrintQuota";
import { API } from "../../../vtc-api/src/core/api";

export type EcardCardData = {
	doorAccessKey: string;
	expiryDate: string;
	currentTime: string;
	userInfo: Omit<EcardUserInfo, "photoStr"> & { photoStr?: string };
	deviceId: string;
	/** Short-lived ecard JWT used for this fetch (not the mobile VTC token) */
	accessToken: string;
	refreshToken: string;
};

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
		const user = await User.findOne({ discordId: session.user.discordId }).select("vtcToken").lean();

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
 * Cached briefly; never stores the VTC token.
 */
export async function getPrintQuota(): Promise<{
	success: boolean;
	data?: PrintQuotaPayload;
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: false, error: "Not authenticated" };
		}
		if (!user.vtcToken) {
			return { success: false, error: "No stored VTC token found. Please sync with your URL first." };
		}

		const data = await loadPrintQuota(user);
		if (!data) {
			return { success: false, error: "Failed to fetch print quota. Your VTC token may have expired." };
		}
		return { success: true, data };
	} catch (error) {
		console.error("print quota fetch failed", { name: error instanceof Error ? error.name : "Error" });
		return {
			success: false,
			error: "Failed to fetch print quota. Your VTC token may have expired.",
		};
	}
}

export async function getProgrammeInfo(): Promise<{
	success: boolean;
	data?: ProgrammeInfo;
	error?: string;
}> {
	try {
		const user = await getAuthenticatedUser();
		if (!user) {
			return { success: false, error: "Not authenticated" };
		}
		if (!user.vtcToken) {
			return { success: false, error: "No stored VTC token found. Please sync with your URL first." };
		}

		const data = await loadProgrammeInfo(user);
		if (!data) {
			return { success: false, error: "Failed to fetch programme information." };
		}
		return { success: true, data };
	} catch (error) {
		console.error("programme fetch failed", { name: error instanceof Error ? error.name : "Error" });
		return {
			success: false,
			error: "Failed to fetch programme information.",
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
		const user = await User.findOne({ discordId: session.user.discordId }).select("vtcToken").lean();
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
 * Fetch the digital e-card from GET /v1/ecard.
 *
 * Flow:
 *  1. registerEcard (mobile VTC token → short-lived ecard JWT)
 *  2. getEcard (Bearer ecard JWT → doorAccessKey + userInfo)
 *
 * Photo is omitted unless `{ includePhoto: true }`.
 */
export async function getEcard(options?: {
	includePhoto?: boolean;
	deviceId?: string;
}): Promise<{
	success: boolean;
	data?: EcardCardData;
	error?: string;
}> {
	try {
		const session = await auth();
		if (!session?.user?.discordId) {
			return { success: false, error: "Not authenticated" };
		}

		await connectDB();
		const user = await User.findOne({ discordId: session.user.discordId }).select("vtcToken").lean();
		if (!user?.vtcToken) {
			return { success: false, error: "No stored VTC token found. Please sync with your URL first." };
		}

		const api = new API({ token: user.vtcToken });
		const registered = await api.registerEcard(options?.deviceId);

		if (!registered.isSuccess || !registered.payload?.accessToken) {
			return {
				success: false,
				error: "Failed to register ecard session. Your VTC token may have expired.",
			};
		}

		const card = await api.getEcard(registered.payload.accessToken);

		if (!card.isSuccess || !card.payload) {
			return {
				success: false,
				error: card.errorMsg || "Failed to fetch e-card. Please try again.",
			};
		}

		const { photoStr, ...userInfoRest } = card.payload.userInfo;
		const userInfo = options?.includePhoto
			? { ...userInfoRest, photoStr }
			: userInfoRest;

		return {
			success: true,
			data: {
				doorAccessKey: card.payload.doorAccessKey,
				expiryDate: card.payload.expiryDate,
				currentTime: card.payload.currentTime,
				userInfo,
				deviceId: registered.deviceId,
				accessToken: registered.payload.accessToken,
				refreshToken: registered.payload.refreshToken,
			},
		};
	} catch (error) {
		console.error("Error fetching e-card:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch e-card",
		};
	}
}

/**
 * Visual student-card fields only (no tokens, door key, or raw photoStr).
 * Photo is returned as a data URL for the signed-in user's own card.
 */
export async function getStudentCard(): Promise<{
	success: boolean;
	data?: StudentCardView;
	error?: string;
}> {
	const result = await getEcard({ includePhoto: true });
	if (!result.success || !result.data) {
		return { success: false, error: result.error || "Failed to fetch e-card" };
	}
	return {
		success: true,
		data: buildStudentCardView(result.data.userInfo),
	};
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
