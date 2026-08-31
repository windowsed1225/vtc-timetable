"use client";

import SessionSplash from "@/components/SessionSplash";
import SignInModal from "@/components/SignInModal";
import StudentCardPanel from "@/components/StudentCard";
import { useSession } from "@/lib/auth-client";
import { Link } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

export default function StudentCardPage() {
	const t = useTranslations("settings");
	const { data: session, isPending } = useSession();
	const [showSignIn, setShowSignIn] = useState(false);

	if (isPending) return <SessionSplash />;

	return (
		<div className="student-card-page min-h-screen flex flex-col bg-[var(--background)]">
			<header className="settings-page-header border-b border-border-default bg-[var(--bg-subtle)]">
				<div className="settings-page-header-inner">
					<div className="flex items-center gap-3 min-w-0">
						<Link href="/" className="btn-icon" aria-label={t("backToCalendar")}>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
							</svg>
						</Link>
						<div className="min-w-0">
							<h1 className="text-lg font-semibold tracking-tight">{t("studentCard")}</h1>
							<p className="settings-page-subtitle">{t("studentCardDescription")}</p>
						</div>
					</div>
				</div>
			</header>

			{!session ? (
				<main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
					<p className="text-[var(--text-secondary)] mb-6 max-w-md">{t("studentCardSignIn")}</p>
					<button type="button" className="btn-primary" onClick={() => setShowSignIn(true)}>
						{t("studentCardSignInAction")}
					</button>
					<SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
				</main>
			) : (
				<main className="student-card-page-main">
					<StudentCardPanel enabled />
				</main>
			)}
		</div>
	);
}
