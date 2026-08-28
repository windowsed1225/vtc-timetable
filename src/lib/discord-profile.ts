export type DiscordUserFields = {
	discordId: string;
	discordUsername?: string;
	discordAvatar?: string;
};

export function discordUserFieldsFromProfile(profile: {
	id: string;
	username?: string;
	avatar?: string | null;
}): DiscordUserFields {
	const fields: DiscordUserFields = {
		discordId: profile.id,
		discordUsername: profile.username,
	};
	if (profile.avatar) {
		fields.discordAvatar = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
	}
	return fields;
}

const pendingByEmail = new Map<string, DiscordUserFields>();

function emailKey(email: string | null | undefined): string | undefined {
	const key = email?.trim().toLowerCase();
	return key || undefined;
}

export function rememberDiscordUserFieldsForEmail(
	email: string | null | undefined,
	fields: DiscordUserFields,
): void {
	const key = emailKey(email);
	if (key) pendingByEmail.set(key, fields);
}

export function takeDiscordUserFieldsForEmail(email: string | null | undefined): DiscordUserFields | undefined {
	const key = emailKey(email);
	if (!key) return undefined;
	const fields = pendingByEmail.get(key);
	if (fields) pendingByEmail.delete(key);
	return fields;
}

export function withRememberedDiscordUserFields<T extends { email?: string | null }>(user: T): T {
	const fields = takeDiscordUserFieldsForEmail(user.email);
	if (!fields) return user;
	return { ...user, ...fields };
}
