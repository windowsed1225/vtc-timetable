import type { EcardUserInfo } from "./ecardRegister";

/**
 * Response from GET https://ecard-api.vtc.edu.hk/v1/ecard
 * Auth: Authorization: Bearer <ecard accessToken from /register or /token/refresh>
 */
export interface ecard {
	isSuccess: boolean;
	errorCode?: number;
	errorMsg?: string | null;
	payload: EcardPayload | null;
}

export interface EcardPayload {
	/** Hex door-access / QR material for campus readers */
	doorAccessKey: string;
	userInfo: EcardUserInfo;
	/** Card validity end (ISO), e.g. "2027-01-04T16:45:00.000Z" */
	expiryDate: string;
	/** Server time when the payload was issued (ISO) */
	currentTime: string;
}

/**
 * Response from POST https://ecard-api.vtc.edu.hk/v1/token/refresh
 * Auth: Authorization: Bearer <refreshToken>
 * Body: { "refreshToken": "<refreshToken>" }
 */
export interface ecardTokenRefresh {
	isSuccess: boolean;
	errorCode?: number;
	errorMsg?: string | null;
	payload: EcardTokenRefreshPayload | null;
}

export interface EcardTokenRefreshPayload {
	accessToken: string;
	refreshToken: string;
}
