"use client";

import { DEFAULT_GRACE_PERIOD_THRESHOLD } from "@/lib/grace-period";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";

// Fixed demo course — SSR-safe constants mirroring the real tracker's data shape.
const COURSE = { code: "ITE3001", line: 1, total: 24, attended: 16, remaining: 6 };
const SAFE_TO_SKIP = 2;

// Playable "class tracker": toggle the remaining classes and watch the
// projected rate move against the Signal-Red 80% pass line.
export default function DemoAttendance() {
	const t = useTranslations("landing.playground.attendance");
	const reduceMotion = useReducedMotion();
	const [attends, setAttends] = useState<boolean[]>(Array(COURSE.remaining).fill(true));

	const attending = attends.filter(Boolean).length;
	const projected = ((COURSE.attended + attending) / COURSE.total) * 100;
	const passing = projected >= DEFAULT_GRACE_PERIOD_THRESHOLD;

	const toggle = (i: number) => setAttends((prev) => prev.map((v, j) => (j === i ? !v : v)));

	return (
		<motion.div
			className="rounded-2xl border border-border bg-surface p-5 md:p-6"
			initial={reduceMotion ? false : { opacity: 0, y: 24 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-80px" }}
			transition={{ duration: 0.45, ease: "easeOut" }}
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-3">
				<span className="flex items-center gap-2">
					<span
						className="platform-chip-bullet"
						style={{ "--chip-color": `var(--line-${COURSE.line})` } as CSSProperties}
					/>
					<span className="font-mono text-sm font-semibold">{COURSE.code}</span>
				</span>
				<span className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">
					{t("title")}
				</span>
			</div>
			<p className="mt-2 text-sm text-text-secondary">{t("caption")}</p>

			{/* Remaining-class toggles — the playable part */}
			<p className="font-display mt-5 mb-2 text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
				{t("remaining")}
			</p>
			<div className="grid grid-cols-6 gap-1.5">
				{attends.map((attend, i) => (
					<button
						key={i}
						type="button"
						onClick={() => toggle(i)}
						aria-pressed={attend}
						aria-label={`${t("remaining")} ${i + 1}`}
						className={`h-10 rounded-lg border text-sm font-semibold transition-colors ${
							attend
								? "bg-success/15 text-success border-success/25"
								: "bg-error/15 text-error border-error/25"
						}`}
					>
						{attend ? "✓" : "✗"}
					</button>
				))}
			</div>

			{/* Projected rate + verdict */}
			<div className="mt-5 flex items-end justify-between gap-3">
				<div>
					<p className="font-display text-[10px] font-bold uppercase tracking-wider text-text-tertiary">
						{t("projected")}
					</p>
					<p className={`font-mono text-4xl font-bold tabular-nums ${passing ? "text-success" : "text-error"}`}>
						{projected.toFixed(1)}%
					</p>
				</div>
				<span className={`badge ${passing ? "badge-success" : "badge-error"}`}>
					{passing ? t("verdictSafe") : t("verdictFailed")}
				</span>
			</div>

			<div className="relative mt-3 pb-5">
				<div className="h-2 w-full overflow-hidden rounded-full bg-overlay">
					<div
						className={`h-full rounded-full transition-all duration-500 ${passing ? "bg-success" : "bg-error"}`}
						style={{ width: `${Math.min(projected, 100)}%` }}
					/>
				</div>
				<div className="absolute -top-1 h-4 w-[2px] bg-[var(--error)]" style={{ left: `${DEFAULT_GRACE_PERIOD_THRESHOLD}%` }} />
				<span
					className="absolute top-4 -translate-x-1/2 font-mono text-[10px] text-error"
					style={{ left: `${DEFAULT_GRACE_PERIOD_THRESHOLD}%` }}
				>
					{t("line80")}
				</span>
			</div>

			{/* Footer: safe-to-skip stat + reset */}
			<div className="mt-3 flex items-center justify-between gap-3">
				<p className="text-xs text-text-tertiary">{t("skipHint", { count: SAFE_TO_SKIP })}</p>
				<button
					type="button"
					onClick={() => setAttends(Array(COURSE.remaining).fill(true))}
					className="btn-secondary text-xs"
				>
					{t("reset")}
				</button>
			</div>
		</motion.div>
	);
}
