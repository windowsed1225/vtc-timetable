"use client";

import SignInModal from "@/components/SignInModal";
import TutorialSimulation from "@/components/TutorialSimulation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import LandingCTA from "./LandingCTA";
import LandingFeatures from "./LandingFeatures";
import LandingHero from "./LandingHero";
import Playground from "./Playground";

// Marketing landing page shown to signed-out visitors at the root route.
// Signed-in users never see this — the page component gates on session state.
export default function LandingPage() {
	const t = useTranslations("landing");
	const [showSignInModal, setShowSignInModal] = useState(false);
	const [showDemo, setShowDemo] = useState(false);

	const openSignIn = () => setShowSignInModal(true);

	return (
		<div className="landing-page">
			<header className="landing-nav">
				<div className="landing-nav-inner">
					<span className="landing-brand">
						<Image src="/vtc-timetable.svg" alt="" width={40} height={40} priority />
						<span>
							<strong>VTC Timetable</strong>
							<small>Vocational Training Council</small>
						</span>
					</span>

					<nav className="landing-nav-links" aria-label={t("navLabel")}>
						<a href="#features">{t("navFeatures")}</a>
						<a href="#demo">{t("navDemo")}</a>
					</nav>

					<button type="button" onClick={openSignIn} className="btn-primary landing-nav-cta">
						{t("terminus.cta")}
					</button>
				</div>
			</header>

			<LandingHero onSignIn={openSignIn} onSeeDemo={() => setShowDemo(true)} />
			<LandingFeatures />
			<Playground />
			<LandingCTA onSignIn={openSignIn} />

			<footer className="landing-footer">
				<p>{t("footer.madeWith")}</p>
				<p>{t("footer.disclaimer")}</p>
			</footer>

			<SignInModal isOpen={showSignInModal} onClose={() => setShowSignInModal(false)} />
			<TutorialSimulation open={showDemo} onClose={() => setShowDemo(false)} />
		</div>
	);
}
