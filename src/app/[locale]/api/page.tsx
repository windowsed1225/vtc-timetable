"use client";

import { checkStoredToken } from "@/app/actions";
import SessionSplash from "@/components/SessionSplash";
import SignInModal from "@/components/SignInModal";
import { useSession } from "@/lib/auth-client";
import { Link } from "@/lib/navigation";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const VtcApiPlayground = dynamic(() => import("@/components/VtcApiPlayground"), {
	ssr: false,
	loading: () => <SessionSplash />,
});

export default function ApiPlaygroundPage() {
	const t = useTranslations("apiPlayground");
	const { data: session, isPending } = useSession();
	const [showSignIn, setShowSignIn] = useState(false);
	const [tokenReady, setTokenReady] = useState<boolean | null>(null);

	useEffect(() => {
		if (!session) {
			setTokenReady(null);
			return;
		}
		let cancelled = false;
		void checkStoredToken().then((result) => {
			if (!cancelled) setTokenReady(result.valid);
		});
		return () => {
			cancelled = true;
		};
	}, [session]);

	if (isPending) return <SessionSplash />;

	return (
		<div className="min-h-screen flex flex-col bg-[var(--background)]">
			<header className="settings-page-header border-b border-border-default bg-[var(--bg-subtle)]">
				<div className="settings-page-header-inner">
					<div className="flex items-center gap-3 min-w-0">
						<Link href="/" className="btn-icon" aria-label={t("back")}>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
								<path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
							</svg>
						</Link>
						<div className="min-w-0">
							<h1 className="text-lg font-semibold tracking-tight">{t("title")}</h1>
							<p className="settings-page-subtitle">{t("subtitle")}</p>
						</div>
					</div>
				</div>
			</header>

			{!session ? (
				<main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
					<p className="text-[var(--text-secondary)] mb-6 max-w-md">{t("signInPrompt")}</p>
					<button type="button" className="btn-primary" onClick={() => setShowSignIn(true)}>
						{t("signIn")}
					</button>
					<SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
				</main>
			) : tokenReady === null ? (
				<SessionSplash />
			) : !tokenReady ? (
				<main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
					<p className="text-[var(--text-secondary)] mb-6 max-w-md">{t("syncPrompt")}</p>
					<Link href="/" className="btn-primary">
						{t("goSync")}
					</Link>
				</main>
			) : (
				<VtcApiPlayground />
			)}
		</div>
	);
}
