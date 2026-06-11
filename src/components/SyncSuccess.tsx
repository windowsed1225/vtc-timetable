"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

interface SyncSuccessProps {
	courseCount: number;
	semesterLabel: string;
	onViewCalendar: () => void;
	onClose: () => void;
	/** Auto-close delay in ms; pass 0 to disable. */
	autoCloseMs?: number;
}

/**
 * Final state of the sync flow — a confirmation screen with a popping green
 * check, a data summary, and View Calendar / Close actions. Auto-closes after a
 * few seconds so users never feel trapped.
 */
export default function SyncSuccess({
	courseCount,
	semesterLabel,
	onViewCalendar,
	onClose,
	autoCloseMs = 4000,
}: SyncSuccessProps) {
	const t = useTranslations("sync");

	useEffect(() => {
		if (!autoCloseMs) return;
		const id = setTimeout(onViewCalendar, autoCloseMs);
		return () => clearTimeout(id);
	}, [autoCloseMs, onViewCalendar]);

	return (
		<div className="animate-fadeIn flex min-h-[260px] flex-col items-center justify-center gap-4 py-4 text-center">
			{/* Popping success check */}
			<motion.div
				initial={{ scale: 0, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 320, damping: 16 }}
				className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-500/30"
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-8 w-8 text-green-400">
					<path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
				</svg>
			</motion.div>

			<div className="space-y-1.5">
				<h3 className="text-xl font-semibold tracking-tight text-zinc-100">{t("successTitle")}</h3>
				<p className="mx-auto max-w-xs text-sm text-zinc-400">
					{t("successSummary", { count: courseCount, semester: semesterLabel })}
				</p>
			</div>

			<div className="mt-2 flex w-full gap-3">
				<button type="button" onClick={onClose} className="btn-secondary flex-1">
					{t("close")}
				</button>
				<button type="button" onClick={onViewCalendar} className="btn-primary flex-1">
					{t("viewCalendar")}
				</button>
			</div>
		</div>
	);
}
