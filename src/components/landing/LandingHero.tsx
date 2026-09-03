"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

interface LandingHeroProps {
	onSignIn: () => void;
	onSeeDemo: () => void;
}

// Split hero: message on the left, a preview of the signed-in next-class card
// on the right. The preview mirrors the real dashboard card's composition.
export default function LandingHero({ onSignIn, onSeeDemo }: LandingHeroProps) {
	const t = useTranslations("landing");
	const reduceMotion = useReducedMotion();

	return (
		<section className="landing-hero">
			<motion.div
				initial={reduceMotion ? false : { opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5, ease: "easeOut" }}
			>
				<span className="landing-badge">{t("badge")}</span>
				<h1 className="landing-title">
					{t("heroTitle")}
					<span>{t("heroTitleAlt")}</span>
				</h1>
				<p className="landing-lede">{t("heroSubtitle")}</p>
				<div className="landing-hero-actions">
					<button type="button" onClick={onSignIn} className="btn-primary landing-cta">
						{t("signIn")}
						<ArrowRight className="w-4 h-4" aria-hidden="true" />
					</button>
					<button type="button" onClick={onSeeDemo} className="btn-secondary landing-cta">
						{t("seeDemo")}
					</button>
				</div>
			</motion.div>

			<motion.div
				className="landing-preview"
				initial={reduceMotion ? false : { opacity: 0, y: 28 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
			>
				<div className="landing-preview-head">
					<div>
						<p className="landing-preview-kicker">{t("preview.nextClass")}</p>
						<p className="landing-preview-title">{t("preview.courseTitle")}</p>
					</div>
					<span className="landing-preview-chip">{t("preview.countdown")}</span>
				</div>

				<div className="landing-preview-meta">
					<span>
						<Clock aria-hidden="true" />
						{t("preview.time")}
					</span>
					<span>
						<MapPin aria-hidden="true" />
						{t("preview.room")}
					</span>
				</div>

				<div className="landing-preview-stats">
					<div>
						<strong>92%</strong>
						<span>{t("preview.statAttendance")}</span>
					</div>
					<div>
						<strong>3</strong>
						<span>{t("preview.statToday")}</span>
					</div>
					<div data-tint="highlight">
						<strong>2</strong>
						<span>{t("preview.statDeadlines")}</span>
					</div>
				</div>

				<p className="landing-preview-note">{t("preview.note")}</p>
			</motion.div>
		</section>
	);
}
