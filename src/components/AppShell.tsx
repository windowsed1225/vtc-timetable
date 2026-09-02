"use client";

import { getAuthenticatedHomeData, type HybridAttendanceStats } from "@/app/actions";
import CampusHeader from "@/components/CampusHeader";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";
import UserDropdown from "@/components/UserDropdown";
import { useRouter } from "@/lib/navigation";
import type { CalendarEvent } from "@/types/timetable";
import { useSession } from "@/lib/auth-client";
import { useCallback, useEffect, useState, type ReactNode } from "react";

interface CourseInfo {
	courseCode: string;
	courseTitle: string;
	colorIndex: number;
	semester: string;
	status: string;
}

interface AppShellProps {
	children: ReactNode;
	/** Latest attendance, when the page already loads it, so the rail stays in sync. */
	attendance?: HybridAttendanceStats[];
	/** Footer line for this route. */
	footer: string;
}

/**
 * Sidebar + top-bar chrome for routes other than the timetable home, which owns
 * its own copy of this layout because its sync, calendar and modal state all
 * hang off the same tree. The rail's own data (courses, events) is loaded here
 * so a page can mount the shell without threading it through.
 */
export default function AppShell({ children, attendance, footer }: AppShellProps) {
	const { data: session } = useSession();
	const router = useRouter();
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [courses, setCourses] = useState<CourseInfo[]>([]);
	const [events, setEvents] = useState<CalendarEvent[]>([]);
	const [ownAttendance, setOwnAttendance] = useState<HybridAttendanceStats[]>([]);
	const [isRefreshingCalendar, setIsRefreshingCalendar] = useState(false);

	const load = useCallback(async () => {
		const result = await getAuthenticatedHomeData();
		if (!result.success || !result.data) return;
		setCourses(result.data.courses);
		setEvents(result.data.events);
		setOwnAttendance(result.data.attendance);
	}, []);

	useEffect(() => {
		if (!session) return;
		void load();
	}, [session, load]);

	const handleRefreshCalendar = async () => {
		setIsRefreshingCalendar(true);
		try {
			await load();
		} finally {
			setIsRefreshingCalendar(false);
		}
	};

	return (
		<div className="dashboard-shell h-screen flex flex-col bg-background overflow-hidden">
			<TopNavbar onSidebarToggle={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

			<div className="flex-1 flex overflow-hidden">
				<button
					type="button"
					className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
					aria-label="Close navigation"
					onClick={() => setSidebarOpen(false)}
				/>

				<Sidebar
					courses={courses}
					events={events}
					attendance={attendance ?? ownAttendance}
					// Syncing lives on the timetable route, which owns the sync modal
					// and its progress state; this hands the user straight to it.
					onSyncClick={() => {
						setSidebarOpen(false);
						router.push("/?sync=1");
					}}
					onRefreshCalendar={handleRefreshCalendar}
					isSyncing={false}
					isRefreshingCalendar={isRefreshingCalendar}
					vtcUrl=""
					user={session?.user}
					sidebarOpen={sidebarOpen}
				/>

				<main className="dashboard-main has-wide-gutter flex-1 flex flex-col relative">
					<div className="calendar-workspace-content">
						<CampusHeader
							events={events}
							userName={session?.user?.name}
							headerActions={session?.user ? <UserDropdown user={session.user} /> : null}
						/>
						{children}
						<footer className="campus-footer">{footer}</footer>
					</div>
				</main>
			</div>
		</div>
	);
}
