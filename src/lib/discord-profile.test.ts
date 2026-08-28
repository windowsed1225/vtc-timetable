import { describe, expect, test } from "bun:test";
import {
	discordUserFieldsFromProfile,
	rememberDiscordUserFieldsForEmail,
	takeDiscordUserFieldsForEmail,
	withRememberedDiscordUserFields,
} from "./discord-profile";

describe("discordUserFieldsFromProfile", () => {
	test("maps Discord snowflake, username, and avatar URL", () => {
		expect(
			discordUserFieldsFromProfile({
				id: "123456789012345678",
				username: "ada",
				avatar: "a1b2c3",
			}),
		).toEqual({
			discordId: "123456789012345678",
			discordUsername: "ada",
			discordAvatar: "https://cdn.discordapp.com/avatars/123456789012345678/a1b2c3.png",
		});
	});

	test("omits avatar URL when Discord has no custom avatar", () => {
		expect(discordUserFieldsFromProfile({ id: "1", username: "ada", avatar: null })).toEqual({
			discordId: "1",
			discordUsername: "ada",
		});
	});
});

describe("pending Discord fields for OAuth create", () => {
	test("Better Auth create hooks can recover fields that input:false stripped", () => {
		rememberDiscordUserFieldsForEmail("Ada@Example.com", {
			discordId: "99",
			discordUsername: "ada",
		});
		expect(withRememberedDiscordUserFields({ email: "ada@example.com", name: "Ada" })).toEqual({
			email: "ada@example.com",
			name: "Ada",
			discordId: "99",
			discordUsername: "ada",
		});
		expect(takeDiscordUserFieldsForEmail("ada@example.com")).toBeUndefined();
	});

	test("email/password create is unchanged when nothing was remembered", () => {
		expect(withRememberedDiscordUserFields({ email: "only@example.com", name: "Only" })).toEqual({
			email: "only@example.com",
			name: "Only",
		});
	});
});
