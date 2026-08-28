import { describe, expect, test } from "bun:test";
import {
	buildStudentCardView,
	campusBrandFrom,
	formatDeliveryMode,
	formatEnglishCardName,
	libraryBarcodeCaption,
	photoDataUrl,
} from "./student-card";

describe("student card formatting", () => {
	test("English name is SURNAME then given names", () => {
		expect(formatEnglishCardName("Chow", "Kin Fung")).toBe("CHOW Kin Fung");
	});

	test("delivery mode expands FT/PT", () => {
		expect(formatDeliveryMode("FT")).toBe("Full Time");
		expect(formatDeliveryMode("full-time")).toBe("Full Time");
		expect(formatDeliveryMode("PT")).toBe("Part Time");
	});

	test("HKIIT campus or IT programme uses the HKIIT brand", () => {
		expect(campusBrandFrom("HKIIT-KT")).toBe("hkiit");
		expect(campusBrandFrom("IVE-CW", "IT114105")).toBe("hkiit");
		expect(campusBrandFrom("IVE-TY")).toBe("vtc");
	});

	test("photo becomes a JPEG data URL", () => {
		expect(photoDataUrl("abc")).toBe("data:image/jpeg;base64,abc");
		expect(photoDataUrl("data:image/png;base64,xx")).toBe("data:image/png;base64,xx");
		expect(photoDataUrl("")).toBeNull();
	});

	test("barcode caption splits whatever prefix the e-card library number uses", () => {
		expect(libraryBarcodeCaption("21882600833491", "260083349", "IT114105")).toBe(
			"2188  260083349  1  IT114105",
		);
		expect(libraryBarcodeCaption("99992500832355", "250083235", "IT114105")).toBe(
			"9999  250083235  5  IT114105",
		);
	});

	test("barcode caption follows raw e-card values when studNo is not inside libraryNumber", () => {
		expect(libraryBarcodeCaption("ABC123", "250083235", "IT114105")).toBe("ABC123  IT114105");
	});

	test("buildStudentCardView maps e-card fields onto the plastic card", () => {
		const view = buildStudentCardView({
			surname: "Chow",
			otherName: "Kin Fung",
			cName: "周健鋒",
			progStructCode: "IT114105",
			progStructCodeDesc: "Higher Diploma in Software Engineering",
			deliveryMode: "FT",
			expiryDate: "08.2028",
			libraryNumber: "21882600833491",
			studNo: "260083349",
			operatingCampus: "HKIIT-KT",
			photoStr: "PHOTO",
		});
		expect(view.englishName).toBe("CHOW Kin Fung");
		expect(view.chineseName).toBe("周健鋒");
		expect(view.deliveryMode).toBe("Full Time");
		expect(view.barcodeValue).toBe("21882600833491");
		expect(view.barcodeCaption).toBe("2188  260083349  1  IT114105");
		expect(view.brand).toBe("hkiit");
		expect(view.photoSrc).toBe("data:image/jpeg;base64,PHOTO");
	});
});
