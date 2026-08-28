import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { MongoClient } from "mongodb";

// Dedicated MongoClient for better-auth. Connection is established lazily.
const client = new MongoClient(process.env.MONGODB_URI!);
const db = client.db();

export const auth = betterAuth({
	secret: process.env.AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL ?? process.env.AUTH_URL ?? process.env.APP_URL,
	database: mongodbAdapter(db),
	emailAndPassword: {
		enabled: true,
	},
	socialProviders: {
		discord: {
			clientId: process.env.AUTH_DISCORD_ID!,
			clientSecret: process.env.AUTH_DISCORD_SECRET!,
			// Populate the legacy `users` fields straight from the Discord profile so
			// the single `users` collection stays the source of truth.
			mapProfileToUser: (profile) => ({
				discordId: profile.id,
				discordUsername: profile.username,
				discordAvatar: profile.avatar
					? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
					: undefined,
			}),
		},
	},
	user: {
		// Use the app's existing `users` collection — do NOT create a separate `user` one.
		modelName: "users",
		additionalFields: {
			discordId: { type: "string", required: false, input: false },
			discordUsername: { type: "string", required: false, input: false },
			discordAvatar: { type: "string", required: false, input: false },
			vtcStudentId: { type: "string", required: false, input: false },
			locale: { type: "string", required: false, input: false },
		},
	},
	plugins: [nextCookies()],
});
