import { describe, expect, test } from "bun:test";
import { code128Bars, encodeCode128 } from "./barcode";

describe("encodeCode128", () => {
	test("even-length digits use Code C start/stop", () => {
		const bits = encodeCode128("21882600833491");
		expect(bits.startsWith("11010011100")).toBe(true);
		expect(bits.endsWith("1100011101011")).toBe(true);
	});

	test("Code C checksum for 00 is value 2", () => {
		// start C (105) + 00 (0) + checksum (105 % 103 = 2) + stop
		expect(encodeCode128("00")).toBe(
			"11010011100" + "11011001100" + "11001100110" + "1100011101011",
		);
	});

	test("non-digit text uses Code B start", () => {
		const bits = encodeCode128("IT114105");
		expect(bits.startsWith("11010010000")).toBe(true);
		expect(bits.endsWith("1100011101011")).toBe(true);
	});

	test("bars only cover 1-modules and span the full pattern", () => {
		const bits = encodeCode128("21882600833491");
		const { bars, moduleCount } = code128Bars("21882600833491");
		expect(moduleCount).toBe(bits.length);
		const painted = bars.reduce((sum, bar) => sum + bar.width, 0);
		expect(painted).toBe([...bits].filter((bit) => bit === "1").length);
		expect(bars.at(-1)!.x + bars.at(-1)!.width).toBeLessThanOrEqual(moduleCount);
	});
});
