import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { MongoClient } from "mongodb";

// Dedicated MongoClient for better-auth. Connection is established lazily.
const client = new MongoClient(process.env.MONGODB_URI!, {
	serverSelectionTimeoutMS: 8000,
	connectTimeoutMS: 8000,
});
const db = client.db();

export const auth = betterAuth({
	secret: process.env.AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
	baseURL: process.env.BETTER_AUTH_URL ?? process.env.AUTH_URL ?? process.env.APP_URL,
	database: mongodbAdapter(db),
	advanced: {
		ipAddress: {
			ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
			trustedProxies: ["127.0.0.1", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
		},
	},
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
