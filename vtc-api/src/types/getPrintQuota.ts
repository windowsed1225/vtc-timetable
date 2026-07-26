export interface getPrintQuota {
	isSuccess: boolean;
	errorCode: number;
	errorMsg: string | null;
	payload: PrintQuotaPayload | null;
}

export interface PrintQuotaPayload {
	/** Campus code, e.g. "HKIIT-KT" */
	campus: string;
	/** Remaining print balance (pages / quota units) */
	balance: number;
	/** Status flag from VTC (0 = ok in observed responses) */
	status: number;
	/** Last update timestamp string from VTC, e.g. "2026-07-26 18:21" */
	lastUpdatedTime: string;
}
