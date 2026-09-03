"use client";

import { LINE_COLORS } from "@/lib/colors";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];
const DAY_START = 9; // 09:00
const DAY_HOURS = 9; // through 18:00

interface DemoEvent {
	id: string;
	day: number; // 0–4 = Mon–Fri
	start: number; // fractional hours, e.g. 9.5
	end: number;
	code: string;
	room: string;
	lecturer: string;
	line: number; // index into LINE_COLORS
}

// Fixed demo week — SSR-safe constants.
const EVENTS: DemoEvent[] = [
	{ id: "e1", day: 0, start: 9, end: 11, code: "ITE3001", room: "Rm 201", lecturer: "Dr. Chan", line: 1 },
	{ id: "e2", day: 0, start: 14, end: 16, code: "ENG2044", room: "Rm 305", lecturer: "Ms. Wong", line: 8 },
	{ id: "e3", day: 1, start: 10, end: 12.5, code: "CSA1010", room: "Lab 2", lecturer: "Mr. Lee", line: 7 },
	{ id: "e4", day: 2, start: 9.5, end: 11, code: "MAT1200", room: "Rm 118", lecturer: "Dr. Ho", line: 3 },
	{ id: "e5", day: 2, start: 13, end: 15, code: "ITE3001", room: "Lab 5", lecturer: "Dr. Chan", line: 1 },
	{ id: "e6", day: 3, start: 11, end: 13, code: "PHY1100", room: "Rm 402", lecturer: "Dr. Ng", line: 0 },
	{ id: "e7", day: 4, start: 14.5, end: 17, code: "ENG2044", room: "Rm 305", lecturer: "Ms. Wong", line: 8 },
];

const fmtHour = (h: number) => `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;

// Playable mini week view: tap a class block to inspect it, like the real calendar.
export default function DemoWeek() {
	const t = useTranslations("landing.playground.week");
	const reduceMotion = useReducedMotion();
	const [selectedId, setSelectedId] = useState<string>(EVENTS[0].id);
	const selected = EVENTS.find((e) => e.id === selectedId) ?? EVENTS[0];

	return (
		<motion.div
			className="landing-demo-card is-clipped"
			initial={reduceMotion ? false : { opacity: 0, y: 24 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-80px" }}
			transition={{ duration: 0.45, ease: "easeOut" }}
		>
			{/* Header */}
			<div className="flex items-center justify-between gap-3">
				<span className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary">
					{t("title")}
				</span>
				<span className="font-mono text-[10px] text-text-tertiary">{t("hint")}</span>
			</div>
			<p className="mt-2 text-sm text-text-secondary">{t("caption")}</p>

			{/* Mini week grid */}
			<div className="mt-5 grid grid-cols-5 gap-1">
				{DAYS.map((day, dayIndex) => (
					<div key={day}>
						<p className="font-display mb-1 text-center text-[9px] font-bold uppercase tracking-widest text-text-tertiary">
							{day}
						</p>
						<div className="relative h-[240px] rounded-md bg-[var(--calendar-header-bg)]">
							{EVENTS.filter((e) => e.day === dayIndex).map((e) => (
								<button
									key={e.id}
									type="button"
									onClick={() => setSelectedId(e.id)}
									aria-pressed={selectedId === e.id}
									className={`absolute inset-x-0.5 flex items-start overflow-hidden rounded-md bg-overlay px-1.5 py-1 text-left font-mono text-[9px] font-semibold text-foreground transition-[filter] hover:brightness-110 ${
										selectedId === e.id ? "outline outline-2 outline-[var(--accent-blue)]" : ""
									}`}
									style={{
										top: `${((e.start - DAY_START) / DAY_HOURS) * 100}%`,
										height: `${((e.end - e.start) / DAY_HOURS) * 100}%`,
										boxShadow: `inset 3px 0 0 ${LINE_COLORS[e.line]}`,
									}}
								>
									<span className="truncate">{e.code}</span>
								</button>
							))}
						</div>
					</div>
				))}
			</div>

			{/* Detail panel for the selected block */}
			<motion.div
				key={selected.id}
				initial={reduceMotion ? false : { opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2, ease: "easeOut" }}
				className="mt-4 rounded-xl border border-border bg-overlay p-3"
			>
				<div className="flex items-center gap-2">
					<span
						className="platform-chip-bullet"
						style={{ "--chip-color": LINE_COLORS[selected.line] } as CSSProperties}
					/>
					<span className="font-mono text-sm font-semibold">{selected.code}</span>
				</div>
				<div className="mt-2 grid grid-cols-3 gap-2">
					<div>
						<p className="font-display text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{t("time")}</p>
						<p className="font-mono text-xs text-foreground">
							{fmtHour(selected.start)}–{fmtHour(selected.end)}
						</p>
					</div>
					<div>
						<p className="font-display text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{t("room")}</p>
						<p className="font-mono text-xs text-foreground">{selected.room}</p>
					</div>
					<div>
						<p className="font-display text-[10px] font-bold uppercase tracking-wider text-text-tertiary">{t("lecturer")}</p>
						<p className="text-xs text-foreground">{selected.lecturer}</p>
					</div>
				</div>
			</motion.div>
		</motion.div>
	);
}
