"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

interface LandingCTAProps {
	onSignIn: () => void;
}

// Closing call to action: the second filled band on the page, matching the
// reference's primary-coloured CTA block.
export default function LandingCTA({ onSignIn }: LandingCTAProps) {
	const t = useTranslations("landing.terminus");
	const reduceMotion = useReducedMotion();

	return (
		<section className="landing-section landing-cta-section">
			<motion.div
				className="landing-cta-band"
				initial={reduceMotion ? false : { opacity: 0, y: 24 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, amount: 0.3 }}
				transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
			>
				<h2>{t("title")}</h2>
				<p>{t("subtitle")}</p>
				<button type="button" onClick={onSignIn} className="landing-cta-button">
					{t("cta")}
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
						<path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
					</svg>
				</button>
			</motion.div>
		</section>
	);
}
