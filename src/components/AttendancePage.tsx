"use client";

import AppShell from "@/components/AppShell";
import AttendanceOverview from "@/components/AttendanceOverview";
import SessionSplash from "@/components/SessionSplash";
import SignInModal from "@/components/SignInModal";
import { useSession } from "@/lib/auth-client";
import { useTranslations } from "next-intl";

/**
 * /attendance route. Attendance used to live in a scrollable panel inside the
 * sidebar; it now owns a full page, and the rail keeps a plain nav item.
 */
export default function AttendancePage() {
	const { data: session, isPending } = useSession();
	const t = useTranslations("attendancePage");
	const tDash = useTranslations("dashboard");

	if (isPending) return <SessionSplash />;

	// Attendance is per-student data, so an unauthenticated visitor gets the
	// sign-in prompt rather than an empty page.
	if (!session) {
		return (
			<div className="attendance-signed-out">
				<h1>{t("title")}</h1>
				<p>{t("signInHint")}</p>
				<SignInModal isOpen onClose={() => {}} />
			</div>
		);
	}

	return (
		<AppShell footer={tDash("footer")}>
			<AttendanceOverview />
		</AppShell>
	);
}
