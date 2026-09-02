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
		<section id="demo" className="landing-section landing-demo-section">
			<div className="landing-demo-inner">
				<motion.div
					className="landing-section-head"
					initial={reduceMotion ? false : { opacity: 0, y: 24 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true, margin: "-80px" }}
					transition={{ duration: 0.45, ease: "easeOut" }}
				>
					<span className="landing-badge">{t("eyebrow")}</span>
					<h2>{t("title")}</h2>
					<p>{t("subtitle")}</p>
				</motion.div>

				<div className="landing-demo-grid">
					<DemoAttendance />
					<DemoWeek />
				</div>
			</div>
		</section>
	);
}
