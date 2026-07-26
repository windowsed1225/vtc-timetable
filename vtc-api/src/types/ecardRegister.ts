/**
 * Response from https://ecard-api.vtc.edu.hk/v1/register
 * Auth: Authorization header = VTC mobile access token
 * Query: deviceID = UUID (random per registration is fine)
 */
export interface ecardRegister {
	isSuccess: boolean;
	payload: EcardRegisterPayload | null;
}

export interface EcardRegisterPayload {
	isRegistered: boolean;
	isAcceptTnC: boolean;
	/** Short-lived JWT for ecard API calls */
	accessToken: string;
	/** Longer-lived JWT for refreshing access */
	refreshToken: string;
	userInfo: EcardUserInfo;
	/** ISO timestamp when the ecard registration session expires */
	expire: string;
}

export interface EcardUserInfo {
	operatingCampus: string;
	studNo: string;
	surname: string;
	otherName: string;
	/** Chinese name */
	cName: string;
	progStructCode: string;
	progStructCodeDesc: string;
	deliveryMode: string;
	year: string;
	class: string;
	regStatus: string;
	smartcardId: string;
	gender: string;
	/** e.g. "08.2026" */
	expiryDate: string;
	libraryNumber: string;
	block0: string;
	block1: string;
	source: string;
	cardTemplate: string;
	/** Base64-encoded JPEG student photo (often large) */
	photoStr: string;
}
