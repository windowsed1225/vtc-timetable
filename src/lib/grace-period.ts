/**
 * Passing attendance rate, in percent of conducted class time.
 * The product default is 80, matching VTC's typical requirement.
 * Store only a per-user override; never persist the default onto every user.
 */
export const DEFAULT_GRACE_PERIOD_THRESHOLD = 80;
export const MIN_GRACE_PERIOD_THRESHOLD = 1;
export const MAX_GRACE_PERIOD_THRESHOLD = 100;

export const EARLY_SEMESTER_WARNING_PROGRESS = 0.15;

export function resolveGracePeriodThreshold(override: number | null | undefined): number {
	return override ?? DEFAULT_GRACE_PERIOD_THRESHOLD;
}

/** Accept only a validated stored override; anything else means "use the default". */
export function storedGracePeriodOverride(value: unknown): number | null {
	const parsed = parseGracePeriodThreshold(value);
	return parsed.ok ? parsed.value : null;
}

export function gracePeriodRatio(threshold: number): number {
	return threshold / 100;
}

export type GracePeriodParseResult =
	| { ok: true; value: number }
	| { ok: false; error: "invalid" | "out_of_range" };

export function parseGracePeriodThreshold(value: unknown): GracePeriodParseResult {
	if (typeof value !== "number" && typeof value !== "string") {
		return { ok: false, error: "invalid" };
	}

	if (typeof value === "string" && value.trim() === "") {
		return { ok: false, error: "invalid" };
	}

	const parsed = typeof value === "number" ? value : Number(value.trim());
	if (!Number.isFinite(parsed)) {
		return { ok: false, error: "invalid" };
	}

	const rounded = Math.round(parsed * 10) / 10;
	if (rounded < MIN_GRACE_PERIOD_THRESHOLD || rounded > MAX_GRACE_PERIOD_THRESHOLD) {
		return { ok: false, error: "out_of_range" };
	}

	return { ok: true, value: rounded };
}

export function thresholdOf(source: { gracePeriodThreshold?: number } | null | undefined): number {
	return resolveGracePeriodThreshold(storedGracePeriodOverride(source?.gracePeriodThreshold));
}
