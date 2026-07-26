"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import DemoAttendance from "./DemoAttendance";
import DemoWeek from "./DemoWeek";

// "Try it" section — playable demo widgets with sample data, no sign-in needed.
export default function Playground() {
	const t = useTranslations("landing.playground");
	const reduceMotion = useReducedMotion();

	return (
		<section className="border-t border-border bg-[var(--bg-subtle)]">
			<div className="max-w-5xl mx-auto px-6 py-20 md:py-28">
				<motion.div
					className="text-center mb-12"
					initial={reduceMotion ? false : { opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-80px" }}
					transition={{ duration: 0.45, ease: "easeOut" }}
				>
					<span className="badge badge-blue font-mono uppercase tracking-widest">{t("eyebrow")}</span>
					<h2 className="mt-4 font-display text-3xl md:text-4xl font-extrabold tracking-tight">{t("title")}</h2>
					<p className="mt-3 text-text-secondary max-w-xl mx-auto">{t("subtitle")}</p>
				</motion.div>

				<div className="grid md:grid-cols-2 gap-6 items-start">
					<DemoAttendance />
					<DemoWeek />
				</div>
			</div>
		</section>
	);
}
