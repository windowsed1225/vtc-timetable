"use client";

import SignInModal from "@/components/SignInModal";
import TutorialSimulation from "@/components/TutorialSimulation";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useState } from "react";
import DepartureBoard from "./DepartureBoard";
import Playground from "./Playground";
import RouteFeatures from "./RouteFeatures";
import TerminusCTA from "./TerminusCTA";

// Marketing landing page shown to signed-out visitors at the root route.
// Signed-in users never see this — the page component gates on session state.
export default function LandingPage() {
	const t = useTranslations("landing");
	const reduceMotion = useReducedMotion();
	const [showSignInModal, setShowSignInModal] = useState(false);
	const [showDemo, setShowDemo] = useState(false);

	const openSignIn = () => setShowSignInModal(true);

	return (
		<div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] overflow-x-hidden">
			{/* Header */}
			<header className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
				<span className="flex items-center gap-2.5">
					<span
						aria-hidden
						className="w-4 h-4 rounded-full shrink-0"
						style={{ background: "var(--bg-surface)", border: "4px solid var(--accent)" }}
					/>
					<span className="font-display text-sm font-bold tracking-tight">VTC Timetable</span>
				</span>
				<button onClick={openSignIn} className="btn-secondary text-xs">
					{t("terminus.cta")}
				</button>
			</header>

			{/* Hero */}
			<section className="max-w-6xl mx-auto px-6 pt-12 md:pt-20 pb-16">
				<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
					<motion.div
						initial={reduceMotion ? false : { opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, ease: "easeOut" }}
					>
						<span className="badge badge-blue font-mono uppercase tracking-widest">{t("badge")}</span>
						<h1 className="mt-5 font-display text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.04]">
							{t("heroTitle")}
							<span className="block mt-3 text-accent-blue">{t("heroTitleAlt")}</span>
						</h1>
						<p className="mt-6 text-base md:text-lg leading-relaxed text-text-secondary max-w-xl">
							{t("heroSubtitle")}
						</p>
						<div className="mt-8 flex flex-wrap items-center gap-3">
							<button onClick={openSignIn} className="btn-primary">
								{t("signIn")}
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
									<path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
								</svg>
							</button>
							<button onClick={() => setShowDemo(true)} className="btn-secondary">
								{t("seeDemo")}
							</button>
						</div>
					</motion.div>

					<motion.div
						initial={reduceMotion ? false : { opacity: 0, y: 28 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.55, ease: "easeOut", delay: 0.12 }}
					>
						<DepartureBoard />
					</motion.div>
				</div>

				{/* Scroll affordance */}
				<div className="mt-16 md:mt-24 flex flex-col items-center gap-2 text-text-tertiary">
					<span className="text-[11px] font-mono uppercase tracking-[0.2em]">{t("scrollHint")}</span>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth={2}
						stroke="currentColor"
						className="landing-scroll-icon animate-bounce motion-reduce:animate-none"
					>
						<path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
					</svg>
				</div>
			</section>

			{/* Feature route map */}
			<RouteFeatures />

			{/* Playable demos */}
			<Playground />

			{/* Terminus CTA */}
			<TerminusCTA onSignIn={openSignIn} />

			{/* Footer */}
			<footer className="border-t border-border py-8 px-6 text-center">
				<p className="text-sm text-text-secondary">{t("footer.madeWith")}</p>
				<p className="mt-1 text-xs text-text-tertiary">{t("footer.disclaimer")}</p>
			</footer>

			<SignInModal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} />
			<TutorialSimulation open={showDemo} onClose={() => setShowDemo(false)} />
		</div>
	);
}
