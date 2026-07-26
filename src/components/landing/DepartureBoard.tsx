"use client";

import { LINE_COLORS } from "@/lib/colors";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

// Mock schedule rows — fixed constants so the server and client render the same
// markup. Line indices pick colors from the signage palette in lib/colors.
const BOARD_ROWS = [
	{ time: "09:00", code: "ITE3001", title: "Web App Development", room: "Rm 201", line: 5, soon: false },
	{ time: "11:00", code: "ENG2044", title: "English for Workplace", room: "Rm 305", line: 8, soon: false },
	{ time: "14:00", code: "CSA1010", title: "Computer Systems", room: "Lab 2", line: 7, soon: true },
	{ time: "16:30", code: "MAT1200", title: "Engineering Maths", room: "Rm 118", line: 3, soon: false },
];

const container = {
	hidden: {},
	show: { transition: { staggerChildren: 0.09, delayChildren: 0.25 } },
};
const row = {
	hidden: { opacity: 0, y: 10 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

// The signature landing element: an MTR-style departure board. Signage is dark
// in both themes, so this plate intentionally uses fixed night-navy colors
// rather than theme tokens.
export default function DepartureBoard() {
	const t = useTranslations("landing.board");
	const reduceMotion = useReducedMotion();

	return (
		<div className="rounded-2xl border border-[#1E3350] bg-[#081220] shadow-2xl overflow-hidden">
			{/* Board header */}
			<div className="flex items-center justify-between px-5 py-3 border-b border-[#14243A] bg-[#0A1524]">
				<span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-[#A8B8C8]">
					{t("title")}
				</span>
				<span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-[#64788E]">
					<span className="w-1.5 h-1.5 rounded-full bg-[#17B877] animate-pulse" />
					{t("live")}
				</span>
			</div>

			{/* Column headers */}
			<div className="flex items-center gap-3 px-5 pt-3 pb-1 text-[9px] font-mono uppercase tracking-[0.16em] text-[#64788E]">
				<span className="w-12">{t("colTime")}</span>
				<span className="w-28">{t("colLine")}</span>
				<span className="flex-1 hidden sm:block">{t("colCourse")}</span>
				<span className="w-14">{t("colRoom")}</span>
				<span className="w-16 text-right">{t("colStatus")}</span>
			</div>

			{/* Rows */}
			<motion.ul
				variants={reduceMotion ? undefined : container}
				initial={reduceMotion ? false : "hidden"}
				animate="show"
				className="px-2 pb-2"
			>
				{BOARD_ROWS.map((r) => (
					<motion.li
						key={r.code}
						variants={reduceMotion ? undefined : row}
						className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-[#0D1B2E] transition-colors"
					>
						<span className="w-12 font-mono text-sm font-medium text-[#F5F7F8] tabular-nums">{r.time}</span>
						<span className="w-28 flex items-center gap-2">
							<span
								className="w-3 h-3 rounded-full shrink-0 bg-[#081220]"
								style={{ border: `3px solid ${LINE_COLORS[r.line]}` }}
							/>
							<span className="font-mono text-xs font-semibold text-[#F5F7F8]">{r.code}</span>
						</span>
						<span className="flex-1 hidden sm:block text-sm text-[#A8B8C8] truncate">{r.title}</span>
						<span className="w-14 font-mono text-xs text-[#A8B8C8]">{r.room}</span>
						<span
							className="w-16 text-right text-[11px] font-semibold"
							style={{ color: r.soon ? "#F5A623" : "#17B877" }}
						>
							{r.soon ? t("statusSoon") : t("statusOnTime")}
						</span>
					</motion.li>
				))}
			</motion.ul>
		</div>
	);
}
