import { describe, expect, test } from "bun:test";
import { planDiscordIdIndex } from "./user-indexes";

describe("planDiscordIdIndex", () => {
	test("replaces the non-partial unique index that treats null as a value", () => {
		expect(
			planDiscordIdIndex([{ name: "discordId_1", key: { discordId: 1 }, unique: true }]),
		).toEqual({
			drop: ["discordId_1"],
			create: true,
		});
	});

	test("leaves a string-only partial unique index alone", () => {
		expect(
			planDiscordIdIndex([
				{
					name: "discordId_1",
					key: { discordId: 1 },
					unique: true,
					partialFilterExpression: { discordId: { $type: "string" } },
				},
			]),
		).toEqual({ drop: [], create: false });
	});

	test("creates the index when users has none on discordId", () => {
		expect(planDiscordIdIndex([{ name: "_id_", key: { _id: 1 } }])).toEqual({
			drop: [],
			create: true,
		});
	});
});
