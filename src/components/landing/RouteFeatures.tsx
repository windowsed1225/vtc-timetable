"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

// Feature stops in spine order — line indices match the .route-spine gradient
// (line-0 → 1 → 2 → 3 → 8 → 9) so each bullet sits on "its" stretch of color.
const STOPS = [
	{ key: "sync", line: 0 },
	{ key: "attendance", line: 1 },
	{ key: "calendar", line: 2 },
	{ key: "deadlines", line: 3 },
	{ key: "export", line: 8 },
	{ key: "bilingual", line: 9 },
] as const;

// Features presented as stations along a vertical metro route line.
export default function RouteFeatures() {
	const t = useTranslations("landing");
	const reduceMotion = useReducedMotion();

	return (
		<section className="max-w-3xl mx-auto px-6 py-20 md:py-28">
			<div className="text-center mb-16">
				<h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">
					{t("routeTitle")}
				</h2>
				<p className="mt-3 text-text-secondary max-w-xl mx-auto">{t("routeSubtitle")}</p>
			</div>

			<ul className="relative">
				<div aria-hidden className="route-spine left-[8px]" />
				{STOPS.map(({ key, line }) => (
					<motion.li
						key={key}
						className="relative pl-14 pb-14 last:pb-0"
						initial={reduceMotion ? false : { opacity: 0, y: 24 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, margin: "-80px" }}
						transition={{ duration: 0.45, ease: "easeOut" }}
					>
						<span
							aria-hidden
							className="station-bullet absolute left-0 top-0.5"
							style={{ "--station-color": `var(--line-${line})` } as CSSProperties}
						/>
						<h3 className="font-display text-lg md:text-xl font-bold tracking-tight">
							{t(`features.${key}.title`)}
						</h3>
						<p className="mt-1.5 text-sm md:text-[15px] leading-relaxed text-text-secondary max-w-lg">
							{t(`features.${key}.desc`)}
						</p>
					</motion.li>
				))}
			</ul>
		</section>
	);
}
