"use client";

import { exportSemesterIcs } from "@/app/actions";
import AppShell from "@/components/AppShell";
import SessionSplash from "@/components/SessionSplash";
import ShareCalendarButton from "@/components/ShareCalendarButton";
import SignInModal from "@/components/SignInModal";
import { useSession } from "@/lib/auth-client";
import { getDefaultSemester, getSemesterDisplayLabel } from "@/lib/utils";
import { CalendarDays, Check, Clipboard, Download, ExternalLink, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * `/tools` — the calendar feed and export controls that also live in the
 * timetable header's Calendar Tools menu, given a full page. Every value here
 * is the signed-in user's own: the feed URL carries their Discord id and the
 * download comes from `exportSemesterIcs`.
 */
export default function CalendarToolsPage() {
	const { data: session, isPending } = useSession();
	const t = useTranslations("tools");
	const tCal = useTranslations("calendar");
	const tDash = useTranslations("dashboard");
	const [semester, setSemester] = useState(getDefaultSemester());
	const [copied, setCopied] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [exportError, setExportError] = useState<string | null>(null);

	if (isPending) return <SessionSplash />;

	if (!session) {
		return (
			<div className="attendance-signed-out">
				<h1>{t("pageTitle")}</h1>
				<p>{t("signInHint")}</p>
				<SignInModal isOpen onClose={() => {}} />
			</div>
		);
	}

	const discordId = session.user.discordId;
	const feedUrl = discordId && typeof window !== "undefined" ? `${window.location.origin}/api/calendar/${discordId}` : null;

	const copyFeed = async () => {
		if (!feedUrl) return;
		try {
			await navigator.clipboard.writeText(feedUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch {
			setExportError(tCal("shareCalendarCopyFailed"));
		}
	};

	const downloadIcs = async () => {
		setExporting(true);
		setExportError(null);
		try {
			const result = await exportSemesterIcs(String(semester));
			if (!result.success || !result.data) {
				setExportError(result.error ?? t("exportFailed"));
				return;
			}
			const blob = new Blob([result.data], { type: "text/calendar;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `vtc-semester-${semester}.ics`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			URL.revokeObjectURL(url);
		} catch {
			setExportError(t("exportFailed"));
		} finally {
			setExporting(false);
		}
	};

	const steps = [
		["01", t("stepGoogleTitle"), t("stepGoogleText")],
		["02", t("stepAppleTitle"), t("stepAppleText")],
		["03", t("stepOutlookTitle"), t("stepOutlookText")],
	] as const;

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

			<div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
				{/* Subscription feed */}
				<section className="rounded-4xl border border-border bg-card p-5 sm:p-7">
					<div className="flex items-start gap-4">
						<span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
							<CalendarDays className="size-6" aria-hidden="true" />
						</span>
						<div className="min-w-0">
							<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("subscriptionEyebrow")}</p>
							<h2 className="mt-1 text-xl font-black text-card-foreground">{t("subscriptionTitle")}</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">{t("subscriptionText")}</p>
						</div>
					</div>

					<div className="mt-7 rounded-3xl border border-border bg-secondary/60 p-4">
						<p className="flex items-center gap-2 text-sm font-bold text-card-foreground">
							<Link2 className="size-4 text-primary" aria-hidden="true" />
							{t("feedLabel")}
						</p>
						{feedUrl ? (
							<div className="mt-3 flex flex-col gap-2 sm:flex-row">
								<code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">{feedUrl}</code>
								<button
									type="button"
									onClick={copyFeed}
									className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
								>
									{copied ? <Check className="size-4" aria-hidden="true" /> : <Clipboard className="size-4" aria-hidden="true" />}
									{copied ? t("copied") : t("copyLink")}
								</button>
							</div>
						) : (
							// No Discord account linked, so there is no feed to hand out yet.
							<p className="mt-3 rounded-xl border border-border bg-background px-3 py-3 text-xs text-muted-foreground">{t("feedNeedsDiscord")}</p>
						)}
					</div>

					{/* Semester sits on its own row so the two actions below keep the
					    reference's single-row pairing. */}
					<label className="mt-4 block">
						<span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{tCal("semester")}</span>
						<select
							value={semester}
							onChange={(event) => setSemester(Number(event.target.value))}
							className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:ring-2 focus:ring-ring sm:w-72"
						>
							{[1, 2, 3].map((value) => (
								<option key={value} value={value}>
									{getSemesterDisplayLabel(value)}
								</option>
							))}
						</select>
					</label>

					<div className="mt-4 flex flex-col gap-3 sm:flex-row">
						<button
							type="button"
							onClick={downloadIcs}
							disabled={exporting}
							className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						>
							<Download className="size-4" aria-hidden="true" />
							{exporting ? tCal("exporting") : t("downloadIcs")}
						</button>
						{feedUrl && (
							<button
								type="button"
								onClick={copyFeed}
								className="flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-border bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
							>
								<ExternalLink className="size-4" aria-hidden="true" />
								{t("copySubscriptionUrl")}
							</button>
						)}
					</div>

					{/* Public share link, previously reachable only from the header menu. */}
					{feedUrl && (
						<div className="mt-4 border-t border-border pt-4">
							<ShareCalendarButton />
						</div>
					)}

					{exportError && <p className="mt-3 text-xs text-error">{exportError}</p>}
				</section>

				{/* Quick setup */}
				<section className="rounded-4xl border border-border bg-card p-5 sm:p-7">
					<p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t("setupEyebrow")}</p>
					<h2 className="mt-1 text-xl font-black text-card-foreground">{t("setupTitle")}</h2>
					<div className="mt-5 flex flex-col gap-3">
						{steps.map(([step, title, text]) => (
							<div key={step} className="flex gap-3 rounded-2xl bg-secondary/60 p-3">
								<span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-background text-xs font-black text-primary">{step}</span>
								<div className="min-w-0">
									<p className="text-sm font-bold text-card-foreground">{title}</p>
									<p className="mt-0.5 text-xs leading-5 text-muted-foreground">{text}</p>
								</div>
							</div>
						))}
					</div>
				</section>
			</div>
		</AppShell>
	);
}
