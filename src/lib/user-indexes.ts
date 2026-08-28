export const DISCORD_ID_INDEX_NAME = "discordId_1";

export const DISCORD_ID_PARTIAL_FILTER = { discordId: { $type: "string" } } as const;

export type ListedIndex = {
	name?: string;
	key: Record<string, unknown>;
	unique?: boolean;
	sparse?: boolean;
	partialFilterExpression?: { discordId?: { $type?: string } };
};

export function planDiscordIdIndex(indexes: ListedIndex[]): { drop: string[]; create: boolean } {
	const discordIdIndexes = indexes.filter((index) => index.key.discordId === 1 && Object.keys(index.key).length === 1);
	const good = discordIdIndexes.find(
		(index) => index.unique === true && index.partialFilterExpression?.discordId?.$type === "string",
	);
	return {
		drop: discordIdIndexes
			.filter((index) => index !== good)
			.map((index) => index.name)
			.filter((name): name is string => Boolean(name)),
		create: !good,
	};
}

export async function ensurePartialUniqueDiscordIdIndex(collection: {
	indexes(): Promise<ListedIndex[]>;
	dropIndex(name: string): Promise<unknown>;
	createIndex(spec: Record<string, number>, options: Record<string, unknown>): Promise<unknown>;
}): Promise<void> {
	const plan = planDiscordIdIndex(await collection.indexes());
	for (const name of plan.drop) {
		await collection.dropIndex(name);
	}
	if (plan.create) {
		await collection.createIndex(
			{ discordId: 1 },
			{
				unique: true,
				name: DISCORD_ID_INDEX_NAME,
				partialFilterExpression: DISCORD_ID_PARTIAL_FILTER,
			},
		);
	}
}
