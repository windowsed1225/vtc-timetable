"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

interface TerminusCTAProps {
	onSignIn: () => void;
}

// Final section — the "terminus" of the route map, with the closing sign-in CTA.
export default function TerminusCTA({ onSignIn }: TerminusCTAProps) {
	const t = useTranslations("landing.terminus");
	const reduceMotion = useReducedMotion();

	return (
		<section className="border-t border-border bg-[var(--bg-subtle)]">
			<motion.div
				className="max-w-2xl mx-auto px-6 py-20 md:py-28 text-center"
				initial={reduceMotion ? false : { opacity: 0, y: 24 }}
				whileInView={{ opacity: 1, y: 0 }}
				viewport={{ once: true, margin: "-80px" }}
				transition={{ duration: 0.45, ease: "easeOut" }}
			>
				{/* Terminus marker — a filled roundel ends the line */}
				<div
					aria-hidden
					className="w-6 h-6 rounded-full bg-accent mx-auto mb-8"
					style={{ boxShadow: "0 0 28px var(--accent-blue-glow)" }}
				/>
				<h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">{t("title")}</h2>
				<p className="mt-4 text-text-secondary">{t("subtitle")}</p>
				<button onClick={onSignIn} className="btn-primary mt-8">
					{t("cta")}
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
						<path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
					</svg>
				</button>
			</motion.div>
		</section>
	);
}
