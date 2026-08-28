import mongoose from "mongoose";

interface MongooseCache {
	conn: typeof mongoose | null;
	promise: Promise<typeof mongoose> | null;
}

declare global {
	var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.mongoose ?? { conn: null, promise: null };

if (!globalThis.mongoose) {
	globalThis.mongoose = cached;
}

function getMongoUri(): string {
	const uri = process.env.MONGODB_URI?.trim();
	if (!uri) {
		throw new Error("MONGODB_URI is not configured");
	}
	return uri;
}

export async function connectDB(): Promise<typeof mongoose> {
	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		cached.promise = mongoose.connect(getMongoUri(), { bufferCommands: false });
	}

	try {
		cached.conn = await cached.promise;
	} catch (error) {
		cached.promise = null;
		throw error;
	}

	return cached.conn;
}

export async function pingMongo(): Promise<boolean> {
	try {
		const connection = await connectDB();
		const db = connection.connection.db;
		if (!db) return false;
		const result = await db.admin().command({ ping: 1 });
		return result.ok === 1;
	} catch (error) {
		console.error("mongodb ping failed", { name: error instanceof Error ? error.name : "Error" });
		return false;
	}
}

export default connectDB;
