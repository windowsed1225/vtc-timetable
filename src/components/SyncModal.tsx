"use client";

import SyncSuccess from "@/components/SyncSuccess";
import { getDefaultSemester, getSemesterDisplayLabel } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

// Real-time progress reported by the staged sync orchestration (see handleSync).
export interface SyncProgress {
	percent: number; // 0–100
	phase: "preparing" | "timetable" | "attendance" | "finalizing";
	semesterLabel?: string;
	coursesDone?: number;
	coursesTotal?: number;
	currentCourseCode?: string;
	currentCourseName?: string;
}

interface SyncModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSync: (url: string, onProgress: (p: SyncProgress) => void, signal: AbortSignal) => Promise<void>;
	/** Sync using the token already stored on the account (no URL needed). */
	onQuickSync?: (onProgress: (p: SyncProgress) => void, signal: AbortSignal) => Promise<void>;
	/** Whether a valid VTC token is already saved for this account. */
	hasSavedToken?: boolean;
	/** Optional: ensure the calendar view is shown when the user clicks "View Calendar". */
	onViewCalendar?: () => void;
	initialUrl?: string;
}

export default function SyncModal({
	isOpen,
	onClose,
	onSync,
	onQuickSync,
	hasSavedToken = true,
	onViewCalendar,
	initialUrl = "",
}: SyncModalProps) {
	const t = useTranslations("sync");
	const [url, setUrl] = useState(initialUrl);
	const [progress, setProgress] = useState<SyncProgress | null>(null);
	const [success, setSuccess] = useState<{ courseCount: number } | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isClosing, setIsClosing] = useState(false);
	// When the user has a saved token, they can opt into the manual URL form.
	const [isUpdatingUrl, setIsUpdatingUrl] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	const syncing = progress !== null;
	// Show the manual URL form when there's no saved token, or the user chose to update it.
	const showManualEntry = !hasSavedToken || isUpdatingUrl;

	if (!isOpen) return null;

	const handleClose = () => {
		// Don't allow dismissing mid-sync via the backdrop/X; use Abort instead.
		if (syncing) return;
		setIsClosing(true);
		setTimeout(() => {
			setIsClosing(false);
			// Reset transient state so a reopen starts fresh.
			setSuccess(null);
			setProgress(null);
			setIsUpdatingUrl(false);
			onClose();
		}, 180);
	};

	const handleViewCalendar = () => {
		onViewCalendar?.();
		handleClose();
	};

	const handleAbort = () => {
		abortRef.current?.abort();
		setProgress(null);
	};

	// Shared lifecycle wrapper for both manual and quick sync runners.
	const startSync = async (
		runner: (onProgress: (p: SyncProgress) => void, signal: AbortSignal) => Promise<void>,
	) => {
		setError(null);
		const controller = new AbortController();
		abortRef.current = controller;
		// Track the course total reported during the attendance phase for the summary.
		let lastCourseCount = 0;
		const report = (p: SyncProgress) => {
			if (typeof p.coursesTotal === "number" && p.coursesTotal > 0) lastCourseCount = p.coursesTotal;
			setProgress(p);
		};
		setProgress({ percent: 0, phase: "preparing" });

		try {
			await runner(report, controller.signal);
			if (controller.signal.aborted) {
				setProgress(null);
				return;
			}
			// Transition to the success view (auto-closes itself after a few seconds).
			setProgress(null);
			setSuccess({ courseCount: lastCourseCount });
		} catch (err) {
			setProgress(null);
			if (!controller.signal.aborted) {
				setError(err instanceof Error ? err.message : "Failed to sync");
			}
		}
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!url.trim()) {
			setError(t("enterUrlError"));
			return;
		}
		startSync((onProgress, signal) => onSync(url, onProgress, signal));
	};

	const handleQuickSync = () => {
		if (!onQuickSync) return;
		startSync((onProgress, signal) => onQuickSync(onProgress, signal));
	};

	// Heading + sub-line for the current phase.
	const phaseHeading = () => {
		if (!progress) return "";
		switch (progress.phase) {
			case "preparing":
				return t("validating");
			case "timetable":
				return t("syncingSemesterSchedule", { semester: progress.semesterLabel ?? "" });
			case "attendance":
				return progress.coursesTotal ? t("syncingAttendance") : t("preparingCourses");
			case "finalizing":
				return t("finalizing");
		}
	};

	const phaseLabel = () => {
		if (!progress) return "";
		return progress.phase === "attendance" || progress.phase === "finalizing" ? t("phaseAttendance") : t("phaseTimetable");
	};

	// Shared "Auto-detected: <semester>" row, used by both the manual and saved-token views.
	const autoDetectedRow = (
		<div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--calendar-header-bg)] border border-[var(--calendar-border)]">
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[var(--text-secondary)] shrink-0">
				<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
			</svg>
			<span className="text-sm text-[var(--text-secondary)]">
				Auto-detected: <span className="font-semibold text-[var(--foreground)]">{getSemesterDisplayLabel(getDefaultSemester())}</span>
			</span>
		</div>
	);

	// Shared error block.
	const errorBlock = error && (
		<div className="p-3 bg-[var(--error-bg)] border border-[rgba(245,83,83,0.15)] rounded-lg">
			<p className="text-sm text-[var(--error)]">{error}</p>
		</div>
	);

	return (
		<div className={`modal-overlay ${isClosing ? "modal-closing" : ""}`} onClick={handleClose}>
			<div className={`modal-content ${isClosing ? "modal-closing" : ""}`} onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-semibold">{t("syncSchedule")}</h2>
					{!syncing && (
						<button onClick={handleClose} className="btn-icon">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
							</svg>
						</button>
					)}
				</div>

				{success ? (
					/* ── Success view ── */
					<SyncSuccess
						courseCount={success.courseCount}
						semesterLabel={getSemesterDisplayLabel(getDefaultSemester())}
						onViewCalendar={handleViewCalendar}
						onClose={handleClose}
					/>
				) : syncing ? (
					/* ── Real-time progress view ── */
					<div className="animate-fadeIn space-y-5">
						{/* Semester / phase context */}
						<div>
							<h3 className="text-base font-semibold text-zinc-100">{phaseHeading()}</h3>
							{progress.phase === "attendance" && progress.currentCourseName && (
								<p className="mt-1 text-sm text-zinc-400">{progress.currentCourseName}</p>
							)}
						</div>

						{/* Overall progress bar */}
						<div>
							<div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
								<span>{phaseLabel()}</span>
								<span className="tabular-nums font-medium text-zinc-300">{Math.round(progress.percent)}%</span>
							</div>
							<div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
								<div
									className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-[width] duration-500 ease-out"
									style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }}
								/>
							</div>
						</div>

						{/* Course counter */}
						{progress.coursesTotal !== undefined && progress.coursesTotal > 0 && (
							<div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
								<span className="text-sm text-zinc-400">{t("coursesSynced")}</span>
								<span className="tabular-nums text-sm font-semibold text-zinc-100">
									{progress.coursesDone ?? 0} / {progress.coursesTotal}
								</span>
							</div>
						)}

						{/* Current item status */}
						{progress.currentCourseCode && (
							<p className="truncate text-xs text-zinc-500">
								{t("currentlyFetching")}:{" "}
								<span className="font-medium text-zinc-300">{progress.currentCourseCode}</span>
								{progress.currentCourseName ? ` — ${progress.currentCourseName}` : ""}
							</p>
						)}

						{/* Abort */}
						<div className="pt-1">
							<button
								type="button"
								onClick={handleAbort}
								className="btn-secondary w-full transition-colors hover:!border-red-900/50 hover:!bg-red-950/40 hover:!text-red-300"
							>
								{t("abort")}
							</button>
						</div>
					</div>
				) : showManualEntry ? (
					/* ── Manual URL entry view ── */
					<form onSubmit={handleSubmit} className="animate-fadeIn space-y-4">
						{/* URL Input */}
						<div>
							<label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
								{t("vtcApiUrl")}
							</label>
							<input
								type="url"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								placeholder={t("vtcUrlPlaceholder")}
								className="input-apple"
								autoFocus
							/>
							<p className="text-xs text-[var(--text-tertiary)] mt-2">
								{t("vtcUrlHint")}
							</p>
						</div>

						{autoDetectedRow}
						{errorBlock}

						{/* Actions */}
						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={isUpdatingUrl ? () => { setIsUpdatingUrl(false); setError(null); } : handleClose}
								className="btn-secondary flex-1"
							>
								{t("cancel")}
							</button>
							<button type="submit" className="btn-primary flex-1">
								{t("syncNow")}
							</button>
						</div>
					</form>
				) : (
					/* ── Saved-token (quick sync) view ── */
					<div className="animate-fadeIn space-y-4">
						{/* Valid connection banner */}
						<div className="flex items-start gap-3 rounded-xl border border-green-900/40 bg-green-950/30 px-4 py-3">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-green-400">
								<path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
							</svg>
							<p className="text-sm text-green-300">{t("validConnection")}</p>
						</div>

						{autoDetectedRow}
						{errorBlock}

						{/* Actions */}
						<div className="flex gap-3 pt-2">
							<button type="button" onClick={handleClose} className="btn-secondary flex-1">
								{t("cancel")}
							</button>
							<button type="button" onClick={handleQuickSync} className="btn-primary flex-1">
								{t("quickSync")}
							</button>
						</div>

						{/* Update URL / different account */}
						<button
							type="button"
							onClick={() => { setIsUpdatingUrl(true); setError(null); }}
							className="w-full text-center text-xs text-zinc-400 transition-colors hover:text-zinc-200"
						>
							{t("updateUrl")}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
