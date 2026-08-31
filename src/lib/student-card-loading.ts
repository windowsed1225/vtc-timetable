export type StudentCardLoadingStage = "account" | "ecard" | "details";

export type StudentCardLoadingProgress = {
	stage: StudentCardLoadingStage;
	percent: number;
};

export function studentCardLoadingProgress(elapsedMs: number): StudentCardLoadingProgress {
	const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;

	if (elapsed < 700) {
		return {
			stage: "account",
			percent: Math.min(22, 8 + Math.floor(elapsed / 50)),
		};
	}

	if (elapsed < 2_200) {
		return {
			stage: "ecard",
			percent: Math.min(64, 24 + Math.floor((elapsed - 700) / 40)),
		};
	}

	return {
		stage: "details",
		percent: Math.min(92, 68 + Math.floor((elapsed - 2_200) / 500)),
	};
}
