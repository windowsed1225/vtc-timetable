import { expect, test } from "bun:test";
import { render } from "takumi-js";
import SharedCalendarOgImage from "./SharedCalendarOgImage";

test("Takumi renders the shared calendar Discord image as PNG", async () => {
	const image = await render(
		<SharedCalendarOgImage
			events={[
				{
					courseCode: "ITP4507",
					courseTitle: "Web Services",
					lessonType: "Lecture",
					startTime: "2026-08-31T05:00:00.000Z",
					endTime: "2026-08-31T07:00:00.000Z",
					location: "KT123",
					colorIndex: 2,
				},
			]}
		/>,
		{ width: 1200, height: 630 },
	);

	expect(Array.from(image.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
});
