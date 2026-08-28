import { pingMongo } from "@/lib/db";
import { pingRedis } from "@/lib/redis";
import { NextResponse } from "next/server";

export async function GET() {
	const [mongodb, redis] = await Promise.all([pingMongo(), pingRedis()]);
	const ready = mongodb;
	const degraded = ready && redis !== "ok";

	return NextResponse.json(
		{
			status: ready ? (degraded ? "degraded" : "ok") : "error",
			mongodb: mongodb ? "ok" : "error",
			redis,
		},
		{ status: ready ? 200 : 503 },
	);
}
