"use client";

import AppShell from "@/components/AppShell";
import MoodleTodoCard from "@/components/MoodleTodoCard";
import SessionSplash from "@/components/SessionSplash";
import SignInModal from "@/components/SignInModal";
import { useSession } from "@/lib/auth-client";
import { useTranslations } from "next-intl";

/**
 * /dashboard route. Its only panel is the Moodle to-do list, anchored at
 * #moodle so the rail's Moodle item scrolls straight to it.
 */
export default function MoodlePage() {
	const { data: session, isPending } = useSession();
	const t = useTranslations("moodle");
	const tDash = useTranslations("dashboard");

	if (isPending) return <SessionSplash />;

	// Deadlines are per-student data, so an unauthenticated visitor gets the
	// sign-in prompt rather than an empty panel.
	if (!session) {
		return (
			<div className="attendance-signed-out">
				<h1>{t("pageTitle")}</h1>
				<p>{t("signInHint")}</p>
				<SignInModal isOpen onClose={() => {}} />
			</div>
		);
	}

	return (
		<AppShell footer={tDash("footer")}>
			<div className="campus-page-heading">
				<p className="campus-breadcrumb">{t("breadcrumb")}</p>
				<div>
					<div className="min-w-0">
						<h2>{t("pageTitle")}</h2>
						<p>{t("pageSubtitle")}</p>
					</div>
				</div>
			</div>

			<div id="moodle" className="scroll-mt-6">
				<MoodleTodoCard />
			</div>
		</AppShell>
	);
}
