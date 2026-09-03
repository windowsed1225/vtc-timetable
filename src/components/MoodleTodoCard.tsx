"use client";

import { getMoodleDeadlines } from "@/app/actions";
import {
	MOODLE_HOME_URL,
	moodleActivityModule,
	resolveMoodleTodoUrl,
} from "@/lib/moodle-links";
import type { CalendarEvent } from "@/types/timetable";
import { ArrowUpRight, FileText, HelpCircle, Paperclip, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

/** Moodle groups its activities by module name; only these three need their own
 *  icon and label, everything else reads as course material. */
const MODULE_KIND = {
	assign: "assignment",
	quiz: "quiz",
} as const;

type Kind = "assignment" | "quiz" | "material";

const KIND_ICON: Record<Kind, typeof FileText> = {
	assignment: FileText,
	quiz: HelpCircle,
	material: Paperclip,
};

const KIND_LABEL: Record<Kind, "typeAssignment" | "typeQuiz" | "typeMaterial"> = {
	assignment: "typeAssignment",
	quiz: "typeQuiz",
	material: "typeMaterial",
};

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
	);
}

/**
 * The Moodle to-do panel. Every destination comes from the deadline payload the
 * VTC API returned and is re-checked by resolveMoodleTodoUrl before it is
 * rendered, so an item whose links do not verify degrades to a note plus Moodle
 * home rather than a guessed course id.
 */
interface MoodleTodoCardProps {
	/** Cap the list on dense layouts such as the home dashboard column. */
	limit?: number;
}

export default function MoodleTodoCard({ limit }: MoodleTodoCardProps = {}) {
	const t = useTranslations("moodle");
	const locale = useLocale();
	const [items, setItems] = useState<CalendarEvent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		getMoodleDeadlines()
			.then((result) => {
				if (!active) return;
				if (!result.success || !result.data) {
					setError(result.error ?? t("loadFailed"));
					return;
				}
				setItems(result.data);
			})
			.catch(() => {
				if (active) setError(t("loadFailed"));
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, [t]);

	const dateLabel = useMemo(
		() => new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }),
		[locale],
	);
	const timeLabel = useMemo(
		() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }),
		[locale],
	);

	// Soonest first, so what is already overdue or due today leads the list.
	const sorted = useMemo(() => {
		const ordered = items.toSorted((a, b) => a.start.getTime() - b.start.getTime());
		return typeof limit === "number" && limit > 0 ? ordered.slice(0, limit) : ordered;
	}, [items, limit]);

	const renderDue = (due: Date) => {
		const now = new Date();
		if (due < now) return t("dueOverdue", { date: dateLabel.format(due) });
		if (isSameDay(due, now)) return t("dueToday", { time: timeLabel.format(due) });
		return t("dueOn", { date: dateLabel.format(due), time: timeLabel.format(due) });
	};

	return (
		<section className="moodle-card">
			<div className="moodle-card-head">
				<div>
					<h2>{t("cardTitle")}</h2>
					<p>{t("cardSubtitle")}</p>
				</div>
				<a href={MOODLE_HOME_URL} target="_blank" rel="noopener noreferrer" className="moodle-open-link">
					{t("openMoodle")}
					<ArrowUpRight aria-hidden="true" />
				</a>
			</div>

			{error ? (
				<p className="moodle-state moodle-state-error">{error}</p>
			) : loading ? (
				<p className="moodle-state">{t("loading")}</p>
			) : sorted.length === 0 ? (
				<div className="moodle-state">
					<p className="moodle-state-title">{t("empty")}</p>
					<p>{t("emptyHint")}</p>
				</div>
			) : (
				<ul className="moodle-list">
					{sorted.map((event) => {
						const { actionUrl, courseUrl, courseCode } = event.resource ?? {};
						const href = resolveMoodleTodoUrl(actionUrl, courseUrl);
						const activityModule = moodleActivityModule(actionUrl);
						const kind: Kind =
							activityModule && activityModule in MODULE_KIND
								? MODULE_KIND[activityModule as keyof typeof MODULE_KIND]
								: "material";
						const Icon = KIND_ICON[kind];
						const overdue = event.start < new Date();
						const key = `${courseCode ?? ""}-${event.title}-${event.start.getTime()}`;

						const body = (
							<>
								<span className={`moodle-item-icon moodle-item-icon-${kind}`}>
									<Icon aria-hidden="true" />
								</span>
								<span className="moodle-item-text">
									<strong>{event.title}</strong>
									<small>
										{courseCode} · {t(KIND_LABEL[kind])}
									</small>
								</span>
								<span className={`moodle-item-due ${overdue ? "is-overdue" : ""}`}>
									{renderDue(event.start)}
								</span>
							</>
						);

						// Neither link verified as a VTC Moodle page: say so and offer
						// Moodle home instead of sending the student somewhere invented.
						if (!href) {
							return (
								<li key={key} className="moodle-item is-unlinked">
									<div className="moodle-item-row">{body}</div>
									<p className="moodle-item-missing">
										<TriangleAlert aria-hidden="true" />
										{t("missingLink")}
										<a href={MOODLE_HOME_URL} target="_blank" rel="noopener noreferrer">
											{t("openMoodleHome")}
										</a>
									</p>
								</li>
							);
						}

						return (
							<li key={key} className="moodle-item">
								<a
									href={href}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={t("itemLabel", { title: event.title })}
									className="moodle-item-row"
								>
									{body}
								</a>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
