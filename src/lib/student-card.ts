import type { EcardUserInfo } from "../../vtc-api/src/types/ecardRegister";

export type StudentCardBrand = "hkiit" | "vtc";

export type StudentCardView = {
	englishName: string;
	chineseName: string;
	programme: string;
	expiryDate: string;
	deliveryMode: string;
	photoSrc: string | null;
	barcodeValue: string;
	barcodeCaption: string;
	brand: StudentCardBrand;
};

type StudentCardFields = Pick<
	EcardUserInfo,
	| "surname"
	| "otherName"
	| "cName"
	| "progStructCode"
	| "progStructCodeDesc"
	| "deliveryMode"
	| "expiryDate"
	| "libraryNumber"
	| "studNo"
	| "operatingCampus"
> & {
	photoStr?: string;
};

export function formatEnglishCardName(surname: string, otherName: string): string {
	const last = surname.trim().toUpperCase();
	const rest = otherName.trim();
	return [last, rest].filter(Boolean).join(" ");
}

export function formatDeliveryMode(mode: string): string {
	const normalized = mode.trim().toLowerCase().replace(/[_-]+/g, " ");
	if (normalized === "ft" || normalized === "full time") return "Full Time";
	if (normalized === "pt" || normalized === "part time") return "Part Time";
	return mode.trim();
}

export function campusBrandFrom(
	operatingCampus: string,
	programmeCode = "",
	programmeName = "",
): StudentCardBrand {
	if (/hkiit/i.test(`${operatingCampus} ${programmeName}`)) return "hkiit";
	if (/^IT\d/i.test(programmeCode.trim())) return "hkiit";
	return "vtc";
}

export function photoDataUrl(photoStr?: string): string | null {
	const value = photoStr?.trim();
	if (!value) return null;
	if (value.startsWith("data:")) return value;
	return `data:image/jpeg;base64,${value}`;
}

export function libraryBarcodeValue(libraryNumber: string): string {
	return libraryNumber.replace(/\s+/g, "");
}

/**
 * Human-readable barcode line from e-card fields only.
 * When `libraryNumber` wraps `studNo`, split prefix / student / trailing check, then programme code.
 */
export function libraryBarcodeCaption(
	libraryNumber: string,
	studNo: string,
	progStructCode: string,
): string {
	const library = libraryBarcodeValue(libraryNumber);
	const student = studNo.replace(/\s+/g, "");
	const programme = progStructCode.trim();
	if (student && library.includes(student)) {
		const index = library.indexOf(student);
		const prefix = library.slice(0, index);
		const trailer = library.slice(index + student.length);
		return [prefix, student, trailer, programme].filter(Boolean).join("  ");
	}
	return [library, programme].filter(Boolean).join("  ");
}

export function buildStudentCardView(
	userInfo: Pick<StudentCardFields, keyof StudentCardFields>,
): StudentCardView {
	return {
		englishName: formatEnglishCardName(userInfo.surname, userInfo.otherName),
		chineseName: userInfo.cName.trim(),
		programme: userInfo.progStructCodeDesc.trim(),
		expiryDate: userInfo.expiryDate.trim(),
		deliveryMode: formatDeliveryMode(userInfo.deliveryMode),
		photoSrc: photoDataUrl(userInfo.photoStr),
		barcodeValue: libraryBarcodeValue(userInfo.libraryNumber),
		barcodeCaption: libraryBarcodeCaption(
			userInfo.libraryNumber,
			userInfo.studNo,
			userInfo.progStructCode,
		),
		brand: campusBrandFrom(
			userInfo.operatingCampus,
			userInfo.progStructCode,
			userInfo.progStructCodeDesc,
		),
	};
}
