"use client";

import {
	disableCalendarShare,
	enableCalendarShare,
	getCalendarShareState,
	regenerateCalendarShare,
	type CalendarShareState,
} from "@/app/actions";
import {
	calendarOwnerViewPath,
	calendarSharePath,
	currentCalendarShareMonth,
	type CalendarShareView,
} from "@/lib/calendar-share";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function ShareCalendarButton() {
	const t = useTranslations("calendar");
	const locale = useLocale() === "zh-HK" ? "zh-HK" : "en";
	const [origin, setOrigin] = useState("");
	const [open, setOpen] = useState(false);
	const [state, setState] = useState<CalendarShareState | null>(null);
	const [working, setWorking] = useState(false);
	const [copied, setCopied] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [view, setView] = useState<CalendarShareView>("week");
	const [month, setMonth] = useState("");
	const [ownerDiscordId, setOwnerDiscordId] = useState("");

	useEffect(() => {
		setOrigin(window.location.origin);
		setMonth(currentCalendarShareMonth(new Date()));
	}, []);

	const sharedMonth = view === "month" ? month : null;
	const sharePath = state?.token ? calendarSharePath(locale, state.token, view, sharedMonth) : null;
	const shareUrl = origin && sharePath ? `${origin}${sharePath}` : "";

	const runAction = async (action: () => Promise<CalendarShareState>) => {
		setWorking(true);
		setError(null);
		try {
			const result = await action();
			setState(result);
			if (!result.success) setError(result.error || t("shareCalendarFailed"));
		} catch {
			setError(t("shareCalendarFailed"));
		} finally {
			setWorking(false);
		}
	};

	const showDialog = () => {
		setOpen(true);
		setCopied(false);
		void runAction(getCalendarShareState);
	};

	const copyLink = async () => {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 3_000);
		} catch {
			setError(t("shareCalendarCopyFailed"));
		}
	};

	const shareLink = async () => {
		if (!shareUrl) return;
		if (!navigator.share) {
			await copyLink();
			return;
		}
		try {
			await navigator.share({
				title: t("shareCalendarTitle"),
				text: t("shareCalendarShareText"),
				url: shareUrl,
			});
		} catch (shareError) {
			if (shareError instanceof DOMException && shareError.name === "AbortError") return;
			setError(t("shareCalendarFailed"));
		}
	};

	const regenerate = () => {
		if (!window.confirm(t("shareCalendarRegenerateConfirm"))) return;
		void runAction(regenerateCalendarShare);
	};

	const disable = () => {
		if (!window.confirm(t("shareCalendarDisableConfirm"))) return;
		void runAction(disableCalendarShare);
	};

	const openOwnerCalendar = () => {
		const ownerPath = calendarOwnerViewPath(locale, ownerDiscordId.trim(), view, sharedMonth);
		if (!ownerPath || !origin) {
			setError(t("shareCalendarOwnerInvalidDiscordId"));
			return;
		}
		window.open(`${origin}${ownerPath}`, "_blank", "noopener,noreferrer");
	};

	return (
		<>
			<button type="button" className="btn-secondary w-full flex items-center justify-center gap-2 text-sm" onClick={showDialog}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-4 h-4" aria-hidden="true">
					<path strokeLinecap="round" strokeLinejoin="round" d="M8.7 13.4 15.3 17m0-10-6.6 3.6M18 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
				</svg>
				{t("shareCalendar")}
			</button>

			{open && typeof document !== "undefined" ? createPortal(
				<div className="calendar-share-overlay" role="presentation" onMouseDown={() => setOpen(false)}>
					<section
						className="calendar-share-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="calendar-share-title"
						onMouseDown={(event) => event.stopPropagation()}
					>
						<div className="calendar-share-dialog-header">
							<div>
								<p>{t("shareCalendarEyebrow")}</p>
								<h2 id="calendar-share-title">{t("shareCalendarTitle")}</h2>
							</div>
							<button type="button" className="btn-icon" onClick={() => setOpen(false)} aria-label={t("shareCalendarClose")}>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
									<path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
								</svg>
							</button>
						</div>

						<p className="calendar-share-description">{t("shareCalendarDescription")}</p>
						<div className="calendar-share-warning">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 4.2 2.5 18a2 2 0 0 0 1.8 3h15.4a2 2 0 0 0 1.8-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
							</svg>
							<span>{t("shareCalendarWarning")}</span>
						</div>

						{working && !state ? <p className="calendar-share-status">{t("shareCalendarLoading")}</p> : null}
						{error ? <p className="calendar-share-error" role="alert">{error}</p> : null}
						<div className="calendar-share-view-picker" role="group" aria-label={t("shareCalendarViewLabel")}>
							{(["day", "week", "month"] as const).map((option) => (
								<button
									key={option}
									type="button"
									className={view === option ? "is-active" : ""}
									aria-pressed={view === option}
									onClick={() => setView(option)}
								>
									{t(`shareCalendarView.${option}`)}
								</button>
							))}
						</div>

						{view === "month" ? (
							<div className="calendar-share-month-picker">
								<label htmlFor="calendar-share-month">{t("shareCalendarMonthLabel")}</label>
								<input
									id="calendar-share-month"
									type="month"
									value={month}
									onChange={(event) => setMonth(event.target.value)}
								/>
							</div>
						) : null}

						{state?.ownerLookupAllowed ? (
							<div className="calendar-share-owner-lookup">
								<div>
									<strong>{t("shareCalendarOwnerLookupTitle")}</strong>
									<span>{t("shareCalendarOwnerLookupDescription")}</span>
								</div>
								<div className="calendar-share-link-row">
									<input
										value={ownerDiscordId}
										onChange={(event) => setOwnerDiscordId(event.target.value)}
										inputMode="numeric"
										autoComplete="off"
										placeholder={t("shareCalendarOwnerDiscordIdPlaceholder")}
										aria-label={t("shareCalendarOwnerDiscordIdLabel")}
									/>
									<button type="button" className="btn-secondary" onClick={openOwnerCalendar}>
										{t("shareCalendarOwnerView")}
									</button>
								</div>
							</div>
						) : null}

						{state?.enabled && shareUrl ? (
							<>
								<label className="calendar-share-link-label" htmlFor="calendar-share-link">{t("shareCalendarLink")}</label>
								<div className="calendar-share-link-row">
									<input id="calendar-share-link" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
									<button type="button" className="btn-secondary" onClick={() => void copyLink()} disabled={working}>
										{copied ? t("shareCalendarCopied") : t("shareCalendarCopy")}
									</button>
								</div>
								<div className="calendar-share-primary-actions">
									<a className="btn-secondary" href={shareUrl} target="_blank" rel="noreferrer">{t("shareCalendarPreview")}</a>
									<button type="button" className="btn-primary" onClick={() => void shareLink()} disabled={working}>{t("shareCalendarShare")}</button>
								</div>
								<div className="calendar-share-danger-actions">
									<button type="button" onClick={regenerate} disabled={working}>{t("shareCalendarRegenerate")}</button>
									<button type="button" onClick={disable} disabled={working}>{t("shareCalendarDisable")}</button>
								</div>
							</>
						) : state && !state.enabled ? (
							<button type="button" className="btn-primary w-full" onClick={() => void runAction(enableCalendarShare)} disabled={working}>
								{working ? t("shareCalendarEnabling") : t("shareCalendarEnable")}
							</button>
						) : null}
					</section>
				</div>,
				document.body,
			) : null}
		</>
	);
}
