"use client";

import { LINE_COLORS } from "@/lib/colors";
import type { CalendarEvent } from "@/types/timetable";
import { Ban, Check, Clock3, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";

export type SessionState = "attended" | "absent" | "upcoming" | "cancelled";

const STATE_ICON = { attended: Check, absent: X, upcoming: Clock3, cancelled: Ban } as const;

const STATE_CLASS: Record<SessionState, string> = {
	attended: "bg-success/15 text-success",
	absent: "bg-error/15 text-error",
	upcoming: "bg-card text-muted-foreground",
	cancelled: "bg-muted text-muted-foreground",
};

/** Where a class stands right now: its stored status, or the clock once it has passed. */
export function sessionState(event: CalendarEvent, now: Date): SessionState {
	const status = event.resource?.status;
	if (status === "CANCELED") return "cancelled";
	if (status === "ABSENT") return "absent";
	if (status === "FINISHED" || event.end < now) return "attended";
	return "upcoming";
}

interface TimetableSessionCardProps {
	event: CalendarEvent;
	now: Date;
	timeLabel: Intl.DateTimeFormat;
	onSelect?: (event: CalendarEvent) => void;
}

/**
 * One class as a compact card: course colour bar, title, code, time, room and
 * attendance state. Shared by the week strip and the month grid so a class
 * reads the same wherever it appears.
 */
export default function TimetableSessionCard({ event, now, timeLabel, onSelect }: TimetableSessionCardProps) {
	const t = useTranslations("week");
	const state = sessionState(event, now);
	const Icon = STATE_ICON[state];
	const color = LINE_COLORS[event.resource?.colorIndex ?? 0] ?? LINE_COLORS[0];
	const title = event.resource?.courseTitle || event.title;

	return (
		<button
			type="button"
			onClick={() => onSelect?.(event)}
			disabled={!onSelect}
			aria-label={`${title} ${timeLabel.format(event.start)}-${timeLabel.format(event.end)}`}
			className={`rounded-xl border border-border bg-secondary/70 p-2 text-left transition hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default ${
				state === "cancelled" ? "opacity-60" : ""
			}`}
		>
			<span className="flex items-start gap-2">
				<span aria-hidden="true" className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ background: color } as CSSProperties} />
				<span className="min-w-0 flex-1">
					<span className={`block truncate text-[11px] font-bold text-card-foreground ${state === "cancelled" ? "line-through" : ""}`}>{title}</span>
					<span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">{event.resource?.courseCode}</span>
					<span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
						<Clock3 className="size-3 shrink-0" aria-hidden="true" />
						{timeLabel.format(event.start)}-{timeLabel.format(event.end)}
					</span>
					{event.resource?.location ? (
						<span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
							<MapPin className="size-3 shrink-0" aria-hidden="true" />
							<span className="truncate">{event.resource.location}</span>
						</span>
					) : null}
					<span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATE_CLASS[state]}`}>
						<Icon className="size-3" aria-hidden="true" />
						{t(`state.${state}`)}
					</span>
				</span>
			</span>
		</button>
	);
}
