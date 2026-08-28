import { describe, expect, test } from "bun:test";
import { programmeInfoFromUserInfo } from "./programme-info";

describe("programmeInfoFromUserInfo", () => {
	test("keeps programme code, name, year, and class group from e-card userInfo", () => {
		expect(
			programmeInfoFromUserInfo({
				progStructCode: "IT114105",
				progStructCodeDesc: "Higher Diploma in Software Engineering",
				year: "1",
				class: "1B",
			}),
		).toEqual({
			progStructCode: "IT114105",
			progStructCodeDesc: "Higher Diploma in Software Engineering",
			year: "1",
			class: "1B",
		});
	});

	test("returns null when every programme field is blank", () => {
		expect(
			programmeInfoFromUserInfo({ progStructCode: " ", progStructCodeDesc: "", year: "", class: "" }),
		).toBeNull();
	});
});
