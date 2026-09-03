"use client";

import { HybridAttendanceStats } from "@/app/actions";
import { skipProjection } from "@/lib/skip-projection";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface SkippingCalculatorProps {
	course: HybridAttendanceStats;
}

export default function SkippingCalculator({ course }: SkippingCalculatorProps) {
	const t = useTranslations("skipping");
	const [skipClassesInput, setSkipClassesInput] = useState<string>("0");
	const skipClasses = parseInt(skipClassesInput) || 0;

	// Same projection rules the course-detail page reads from.
	const { attendedCount, remainingClasses, currentRate, threshold, projectedRate, isSafe, safeToSkipCount: safeToSkipClasses, requiredClasses, sliderMax } = skipProjection(course, skipClasses);

	const handleSkipClassesChange = (val: string) => {
		if (val === "") {
			setSkipClassesInput("");
			return;
		}
		// Allow integer input for classes
		const num = parseInt(val);
		if (isNaN(num)) return;
		setSkipClassesInput(Math.min(sliderMax, Math.max(0, num)).toString());
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-sm flex items-center gap-2">
					<span className="text-lg">🧮</span> {t("title")}
				</h3>
				<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${currentRate < threshold ? "bg-error/15 text-error" : "bg-success/15 text-success"}`}>Current: {currentRate.toFixed(1)}%</span>
			</div>

			<div className="space-y-3">
				<div className="flex flex-col gap-1.5">
					<label className="text-sm text-text-secondary">{t("howManySkip", { remaining: remainingClasses })}</label>
					<div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
						<input type="range" min="0" max={sliderMax} step="1" value={parseInt(skipClassesInput) || 0} onChange={(e) => handleSkipClassesChange(e.target.value)} className="flex-1 accent-[var(--calendar-today)] cursor-pointer" />
						<div className="flex items-center gap-1">
							<input
								type="text"
								inputMode="numeric"
								value={skipClassesInput}
								onChange={(e) => {
									const val = e.target.value.replace(/[^0-9]/g, "");
									handleSkipClassesChange(val);
								}}
								className="w-14 px-2 py-1 bg-overlay border border-border rounded-md text-center text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--calendar-today)]"
							/>
							<span className="text-xs text-text-tertiary">{t("classes")}</span>
						</div>
					</div>
				</div>

				<div className={`p-4 rounded-xl border transition-all duration-300 ${isSafe ? "bg-success/10 border-success/25" : "bg-error/10 border-error/25"}`}>
					<div className="flex items-center justify-between mb-2">
						<span className="text-sm font-medium">{t("projectedFinalRate")}</span>
						<span className={`text-xl font-bold font-mono ${isSafe ? "text-success" : "text-error"}`}>{projectedRate.toFixed(1)}%</span>
					</div>

					<div className="flex items-center gap-2">
						{isSafe ? (
							<>
								<span className="text-xl">✅</span>
								<p className="text-sm text-success">{t("safeToSkip", { threshold })}</p>
							</>
						) : (
							<>
								<span className="text-xl">⚠️</span>
								<p className="text-sm text-error font-medium">{t("danger", { threshold })}</p>
							</>
						)}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3 pt-2">
					<div className="p-3 bg-overlay rounded-md border border-border">
						<p className="text-[10px] text-text-tertiary mb-0.5">{t("safeToSkipCount")}</p>
						<p className="text-xs font-bold">
							{safeToSkipClasses} {t("classes")}
						</p>
					</div>
					<div className="p-3 bg-overlay rounded-md border border-border">
						<p className="text-[10px] text-text-tertiary mb-0.5">{t("attendedClasses")}</p>
						<p className="text-xs font-bold">{attendedCount}</p>
					</div>
					<div className="p-3 bg-overlay rounded-md border border-border">
						<p className="text-[10px] text-text-tertiary mb-0.5">{t("requiredThreshold", { threshold })}</p>
						<p className="text-xs font-bold">
							{requiredClasses} {t("classes")}
						</p>
					</div>
					<div className="p-3 bg-overlay rounded-md border border-border">
						<p className="text-[10px] text-text-tertiary mb-0.5">{t("maxPossible")}</p>
						<p className="text-xs font-bold">{(course.maxPossibleMinutesRate ?? course.maxPossibleRate ?? 100).toFixed(0)}%</p>
					</div>
				</div>
			</div>
		</div>
	);
}
