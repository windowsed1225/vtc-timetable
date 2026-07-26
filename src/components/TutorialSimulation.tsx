"use client";

import SyncSuccess from "@/components/SyncSuccess";
import { getDefaultSemester, getSemesterDisplayLabel } from "@/lib/utils";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

const MOCK_URL = "https://mobile.vtc.edu.hk/api?platform=app&token=DEMO-A1B2-C3D4-E5F6";

type Phase = "form" | "syncing" | "success";

interface TutorialSimulationProps {
	open: boolean;
	onClose: () => void;
}

/**
 * TutorialSimulation — a self-contained "ghost cursor" walkthrough. An animated
 * fake cursor moves to the URL field, "clicks", types a mock URL, then moves to
 * the Sync button and clicks it, ending on a success state. Purely cosmetic — it
 * performs no real sync.
 */
export default function TutorialSimulation({ open, onClose }: TutorialSimulationProps) {
	const t = useTranslations("sync");
	const tTour = useTranslations("tour");

	const inputRef = useRef<HTMLInputElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const [cursor, setCursor] = useState(() => ({
		x: typeof window !== "undefined" ? window.innerWidth / 2 : 0,
		y: typeof window !== "undefined" ? window.innerHeight - 40 : 0,
	}));
	const [clicking, setClicking] = useState(false);
	const [typed, setTyped] = useState("");
	const [focused, setFocused] = useState(false);
	const [phase, setPhase] = useState<Phase>("form");

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

		// Reset to the starting state each time the demo opens.
		setPhase("form");
		setTyped("");
		setFocused(false);
		setClicking(false);
		setCursor({ x: window.innerWidth / 2, y: window.innerHeight - 40 });

		const run = async () => {
			await wait(500);
			if (cancelled) return;

			// Step 1: move to the URL input
			const ir = inputRef.current?.getBoundingClientRect();
			if (ir) setCursor({ x: ir.right - 28, y: ir.top + ir.height / 2 });
			await wait(1100);
			if (cancelled) return;

			// Step 2: "click" the input
			setClicking(true);
			await wait(220);
			setClicking(false);
			setFocused(true);
			await wait(350);
			if (cancelled) return;

			// Step 3: quickly "type"/paste the mock URL
			for (let i = 1; i <= MOCK_URL.length; i++) {
				if (cancelled) return;
				setTyped(MOCK_URL.slice(0, i));
				await wait(12);
			}
			await wait(500);
			if (cancelled) return;
			setFocused(false);

			// Step 4: move to the Sync button and click
			const br = buttonRef.current?.getBoundingClientRect();
			if (br) setCursor({ x: br.left + br.width / 2, y: br.top + br.height / 2 });
			await wait(1100);
			if (cancelled) return;
			setClicking(true);
			await wait(220);
			setClicking(false);

			// Step 5: syncing → success
			setPhase("syncing");
			await wait(1600);
			if (cancelled) return;
			setPhase("success");
		};

		run();
		return () => {
			cancelled = true;
		};
	}, [open]);

	if (!open) return null;

	return (
		<div className="modal-overlay" onClick={onClose}>
			<div className="modal-content" onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-semibold">{t("syncSchedule")}</h2>
					<button onClick={onClose} className="btn-icon" aria-label={tTour("closeDemo")} title={tTour("closeDemo")}>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{phase === "success" ? (
					/* Success state — reuse the real flow's SyncSuccess view for consistency.
					   Mock summary; no auto-close so the demo waits for the user. */
					<SyncSuccess
						courseCount={5}
						semesterLabel={getSemesterDisplayLabel(getDefaultSemester())}
						onViewCalendar={onClose}
						onClose={onClose}
						autoCloseMs={0}
					/>
				) : (
					<div className="space-y-4">
						{/* URL Input */}
						<div>
							<label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">{t("vtcApiUrl")}</label>
							<input
								ref={inputRef}
								type="text"
								readOnly
								value={typed}
								placeholder={t("vtcUrlPlaceholder")}
								className={`input-apple transition-shadow ${focused ? "ring-2 ring-accent-blue/60 border-accent-blue" : ""}`}
							/>
							<p className="text-xs text-[var(--text-tertiary)] mt-2">{t("vtcUrlHint")}</p>
						</div>

						{/* Auto-detected semester */}
						<div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--calendar-header-bg)] border border-[var(--calendar-border)]">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[var(--text-secondary)] shrink-0">
								<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
							</svg>
							<span className="text-sm text-[var(--text-secondary)]">
								Auto-detected: <span className="font-semibold text-[var(--foreground)]">{getSemesterDisplayLabel(getDefaultSemester())}</span>
							</span>
						</div>

						{/* Actions */}
						<div className="flex gap-3 pt-2">
							<button type="button" disabled className="btn-secondary flex-1 opacity-60">
								{t("cancel")}
							</button>
							<button ref={buttonRef} type="button" disabled className={`btn-primary flex-1 ${phase === "syncing" ? "btn-syncing" : ""}`}>
								{phase === "syncing" ? (
									<span className="flex items-center justify-center gap-2">
										<svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
										</svg>
										{t("syncing")}
									</span>
								) : (
									t("syncNow")
								)}
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Ghost cursor (sibling of the modal so `fixed` tracks the viewport) */}
			<motion.div
				className="pointer-events-none fixed left-0 top-0 z-[10000]"
				animate={{ x: cursor.x - 4, y: cursor.y - 2, scale: clicking ? 0.8 : 1 }}
				transition={{ x: { duration: 0.9, ease: "easeInOut" }, y: { duration: 0.9, ease: "easeInOut" }, scale: { duration: 0.15 } }}
			>
				<div className="relative">
					{clicking && <span className="absolute -left-2 -top-2 h-6 w-6 animate-ping rounded-full border border-white/70" />}
					<svg width="26" height="26" viewBox="0 0 24 24" className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
						<path d="M5 2.5 19 10l-6.2 1.9L10.7 18 5 2.5Z" fill="white" stroke="#0B1D33" strokeWidth="1.2" strokeLinejoin="round" />
					</svg>
				</div>
			</motion.div>
		</div>
	);
}
