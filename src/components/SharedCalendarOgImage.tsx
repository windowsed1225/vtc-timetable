import { currentCalendarShareMonth, type CalendarShareView, type SharedCalendarEvent } from "@/lib/calendar-share";
import { LINE_COLORS } from "@/lib/colors";
import { APP_TIME_ZONE } from "@/lib/event-date";

const CARD_BORDER = "#1e3350";
const CARD_BACKGROUND = "rgba(14,28,47,0.82)";
const MUTED = "#7f94aa";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CELL_GAP = 6;
/** Height left for week rows once the 630px canvas pays for its header, weekday row, and footer. */
const MONTH_ROWS_HEIGHT = 380;

/** Same day bucketing the shared page uses, so the grid and the live view agree. */
function dayOfMonth(value: string): number {
	return Number(
		new Intl.DateTimeFormat("en-CA", { day: "2-digit", timeZone: APP_TIME_ZONE }).format(new Date(value)),
	);
}

function startTime(value: string): string {
	return new Intl.DateTimeFormat("en-HK", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: APP_TIME_ZONE,
	}).format(new Date(value));
}

type MonthCell = { day: number; events: SharedCalendarEvent[] } | null;

/** Sunday-start weeks covering the anchor month, padded so every row holds 7 cells. */
function monthWeeks(month: string, events: SharedCalendarEvent[]): MonthCell[][] {
	const year = Number(month.slice(0, 4));
	const monthIndex = Number(month.slice(5, 7)) - 1;
	const dayCount = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
	const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();

	const byDay = new Map<number, SharedCalendarEvent[]>();
	for (const event of events) {
		const day = dayOfMonth(event.startTime);
		byDay.set(day, [...(byDay.get(day) ?? []), event]);
	}

	const cells: MonthCell[] = [
		...Array.from({ length: leading }, () => null),
		...Array.from({ length: dayCount }, (_, index) => ({ day: index + 1, events: byDay.get(index + 1) ?? [] })),
	];
	while (cells.length % 7 !== 0) cells.push(null);

	return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

function MonthGrid({ month, events }: { month: string; events: SharedCalendarEvent[] }) {
	const weeks = monthWeeks(month, events);
	// The canvas is a fixed 630px, and a flexed row grows to whatever it holds, so the last
	// week of a 6-week month would spill past the footer. Rows get an explicit share instead.
	const rowHeight = Math.floor((MONTH_ROWS_HEIGHT - CELL_GAP * (weeks.length - 1)) / weeks.length);
	const eventsPerCell = rowHeight >= 66 ? 2 : 1;

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: `${CELL_GAP}px`, marginTop: "20px" }}>
			<div style={{ display: "flex", gap: `${CELL_GAP}px`, height: "20px" }}>
				{WEEKDAYS.map((weekday) => (
					<div
						key={weekday}
						style={{
							display: "flex",
							flex: 1,
							justifyContent: "center",
							fontSize: "15px",
							letterSpacing: "0.12em",
							color: MUTED,
						}}
					>
						{weekday.toUpperCase()}
					</div>
				))}
			</div>
			{weeks.map((week, weekIndex) => (
				<div key={`week-${weekIndex}`} style={{ display: "flex", gap: `${CELL_GAP}px`, height: `${rowHeight}px` }}>
					{week.map((cell, dayIndex) => (
						<div
							key={`cell-${weekIndex}-${dayIndex}`}
							style={{
								display: "flex",
								flexDirection: "column",
								flex: 1,
								overflow: "hidden",
								padding: "4px 7px",
								borderRadius: "10px",
								border: `1px solid ${cell ? CARD_BORDER : "transparent"}`,
								background: cell ? CARD_BACKGROUND : "transparent",
							}}
						>
							{cell ? (
								<div style={{ display: "flex", flexDirection: "column" }}>
									<div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
										<div style={{ fontSize: "15px", fontWeight: 650, color: cell.events.length ? "#f5f7f8" : MUTED }}>
											{cell.day}
										</div>
										{/* The overflow count shares the day's line; its own line would clip in a 6-week month. */}
										{cell.events.length > eventsPerCell ? (
											<div style={{ fontSize: "11px", color: MUTED }}>+{cell.events.length - eventsPerCell}</div>
										) : null}
									</div>
									{cell.events.slice(0, eventsPerCell).map((event) => (
										<div
											key={`${event.courseCode}-${event.startTime}`}
											style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "3px" }}
										>
											<div
												style={{
													width: "4px",
													height: "13px",
													borderRadius: "999px",
													background: LINE_COLORS[event.colorIndex] ?? LINE_COLORS[0],
												}}
											/>
											<div style={{ fontSize: "12px", color: "#b4c2d0" }}>{startTime(event.startTime)}</div>
											<div style={{ fontSize: "12px", fontWeight: 650 }}>{event.courseCode}</div>
										</div>
									))}
								</div>
							) : null}
						</div>
					))}
				</div>
			))}
		</div>
	);
}

function eventDate(value: string): string {
	return new Intl.DateTimeFormat("en-HK", {
		weekday: "short",
		day: "2-digit",
		month: "short",
		timeZone: APP_TIME_ZONE,
	}).format(new Date(value));
}

function eventTime(start: string, end: string): string {
	const formatter = new Intl.DateTimeFormat("en-HK", {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
		timeZone: APP_TIME_ZONE,
	});
	return `${formatter.format(new Date(start))}–${formatter.format(new Date(end))}`;
}

function monthLabel(month: string): string {
	return new Intl.DateTimeFormat("en-HK", {
		year: "numeric",
		month: "long",
		timeZone: APP_TIME_ZONE,
	}).format(new Date(`${month}-15T00:00:00.000Z`)).toUpperCase();
}

export default function SharedCalendarOgImage({
	events,
	view = "week",
	month = null,
}: {
	events: SharedCalendarEvent[];
	view?: CalendarShareView;
	month?: string | null;
}) {
	const visibleEvents = events.slice(0, 5);
	// A month link is scoped to a whole month, so the preview shows that month's grid rather
	// than the first five classes, which alone say nothing about the month.
	const gridMonth = view === "month" ? (month ?? currentCalendarShareMonth(new Date())) : null;
	const rangeLabel = view === "day" ? "TODAY" : gridMonth ? monthLabel(gridMonth) : "NEXT 7 DAYS";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				padding: "54px 62px",
				background: "linear-gradient(135deg, #07111f 0%, #0e1c2f 70%, #13263c 100%)",
				color: "#f5f7f8",
				fontFamily: "Geist",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
					<div
						style={{
							width: "16px",
							height: "54px",
							borderRadius: "999px",
							background: "#3d9be9",
							boxShadow: "0 0 26px rgba(61,155,233,0.45)",
						}}
					/>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ fontSize: "18px", letterSpacing: "0.16em", color: "#7f94aa" }}>
							SHARED SCHEDULE
						</div>
						<div style={{ marginTop: "4px", fontSize: "44px", fontWeight: 800 }}>
							VTC Timetable
						</div>
					</div>
				</div>
				<div
					style={{
						display: "flex",
						padding: "12px 18px",
						border: "1px solid #2e4a6e",
						borderRadius: "999px",
						fontSize: "17px",
						color: "#b4c2d0",
					}}
				>
					{rangeLabel}
				</div>
			</div>

			{gridMonth ? (
				<MonthGrid month={gridMonth} events={events} />
			) : (
				<div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "34px", flex: 1 }}>
					{visibleEvents.length === 0 ? (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								flex: 1,
								border: "1px solid #1e3350",
								borderRadius: "20px",
								fontSize: "30px",
								color: "#7f94aa",
							}}
						>
							No classes scheduled
						</div>
					) : (
						visibleEvents.map((event) => (
							<div
								key={`${event.courseCode}-${event.startTime}`}
								style={{
									display: "flex",
									alignItems: "center",
									height: "72px",
									padding: "0 22px 0 0",
									overflow: "hidden",
									border: "1px solid #1e3350",
									borderRadius: "15px",
									background: "rgba(14,28,47,0.82)",
								}}
							>
								<div
									style={{
										width: "8px",
										height: "100%",
										background: LINE_COLORS[event.colorIndex] ?? LINE_COLORS[0],
									}}
								/>
								<div style={{ width: "220px", display: "flex", flexDirection: "column", paddingLeft: "20px" }}>
									<div style={{ fontSize: "18px", color: "#7f94aa" }}>{eventDate(event.startTime)}</div>
									<div style={{ marginTop: "2px", fontSize: "23px", fontWeight: 650 }}>{eventTime(event.startTime, event.endTime)}</div>
								</div>
								<div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
									<div style={{ fontSize: "25px", fontWeight: 750 }}>{event.courseCode}</div>
									<div style={{ marginTop: "2px", fontSize: "17px", color: "#b4c2d0" }}>{event.courseTitle}</div>
								</div>
								<div style={{ display: "flex", fontSize: "20px", fontWeight: 650, color: "#b4c2d0" }}>
									{event.location || "Room TBA"}
								</div>
							</div>
						))
					)}
				</div>
			)}

			<div style={{ display: "flex", justifyContent: "space-between", marginTop: "22px", fontSize: "16px", color: "#7f94aa" }}>
				<div>Open the link to view the live schedule</div>
				<div>vtc-timetable</div>
			</div>
		</div>
	);
}
