"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
	Bell,
	CalendarDays,
	ClipboardCheck,
	Download,
	Languages,
	RefreshCw,
} from "lucide-react";
import { useTranslations } from "next-intl";

// Six real features, one card each, on an even grid.
const FEATURES = [
	{ key: "sync", tint: "1", Icon: RefreshCw },
	{ key: "attendance", tint: "2", Icon: ClipboardCheck },
	{ key: "calendar", tint: "3", Icon: CalendarDays },
	{ key: "deadlines", tint: "4", Icon: Bell },
	{ key: "export", tint: "5", Icon: Download },
	{ key: "bilingual", tint: "6", Icon: Languages },
] as const;

export default function LandingFeatures() {
	const t = useTranslations("landing");
	const reduceMotion = useReducedMotion();

	return (
		<section id="features" className="landing-section">
			<div className="landing-section-head">
				<h2>{t("routeTitle")}</h2>
				<p>{t("routeSubtitle")}</p>
			</div>

			<div className="landing-bento">
				{FEATURES.map((feature, index) => (
					<motion.article
						key={feature.key}
						className="landing-bento-cell"
						initial={reduceMotion ? false : { opacity: 0, y: 22 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true, amount: 0.3 }}
						transition={{ duration: 0.45, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
					>
						<span className="landing-bento-icon" data-tint={feature.tint}>
							<feature.Icon aria-hidden="true" />
						</span>
						<h3>{t(`features.${feature.key}.title`)}</h3>
						<p>{t(`features.${feature.key}.desc`)}</p>
					</motion.article>
				))}
			</div>
		</section>
	);
}
