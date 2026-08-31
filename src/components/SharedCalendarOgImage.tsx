import type { CalendarShareView, SharedCalendarEvent } from "@/lib/calendar-share";
import { LINE_COLORS } from "@/lib/colors";
import { APP_TIME_ZONE } from "@/lib/event-date";

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
	const rangeLabel = view === "day"
		? "TODAY"
		: view === "month"
			? (month ? monthLabel(month) : "THIS MONTH")
			: "NEXT 7 DAYS";

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

			<div style={{ display: "flex", justifyContent: "space-between", marginTop: "22px", fontSize: "16px", color: "#7f94aa" }}>
				<div>Open the link to view the live schedule</div>
				<div>vtc-timetable</div>
			</div>
		</div>
	);
}
