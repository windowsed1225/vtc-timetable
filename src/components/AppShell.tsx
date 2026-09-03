"use client";

import { getAuthenticatedHomeData } from "@/app/actions";
import CampusHeader from "@/components/CampusHeader";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";
import UserDropdown from "@/components/UserDropdown";
import { useRouter } from "@/lib/navigation";
import type { CalendarEvent } from "@/types/timetable";
import { useSession } from "@/lib/auth-client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, type ReactNode } from "react";

interface AppShellProps {
	children: ReactNode;
	/** Footer line for this route. */
	footer: string;
}

/**
 * Sidebar + top-bar chrome for routes other than the timetable home, which owns
 * its own copy of this layout because its sync, calendar and modal state all
 * hang off the same tree. The rail's own data (courses, events) is loaded here
 * so a page can mount the shell without threading it through.
 */
export default function AppShell({ children, footer }: AppShellProps) {
	const { data: session } = useSession();
	const router = useRouter();
	const tNav = useTranslations("nav");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [events, setEvents] = useState<CalendarEvent[]>([]);

	const load = useCallback(async () => {
		const result = await getAuthenticatedHomeData();
		if (!result.success || !result.data) return;
		setEvents(result.data.events);
	}, []);

	useEffect(() => {
		if (!session) return;
		void load();
	}, [session, load]);


	return (
		<div className="dashboard-shell h-screen flex flex-col bg-background overflow-hidden">
			<TopNavbar
				onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
				sidebarOpen={sidebarOpen}
				user={session?.user}
			/>

			<div className="flex-1 flex overflow-hidden">
				<button
					type="button"
					className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
					aria-label={tNav("closeNavigation")}
					onClick={() => setSidebarOpen(false)}
				/>

				<Sidebar
					// Syncing lives on the timetable route, which owns the sync modal
					// and its progress state; this hands the user straight to it.
					onSyncClick={() => {
						setSidebarOpen(false);
						router.push("/?sync=1");
					}}
					isSyncing={false}
					vtcUrl=""
					user={session?.user}
					sidebarOpen={sidebarOpen}
				/>

				<main className="dashboard-main has-wide-gutter flex-1 flex flex-col relative">
					<div className="calendar-workspace-content">
						<CampusHeader
							events={events}
							userName={session?.user?.name}
							headerActions={
								session?.user ? (
									<div className="campus-header-account">
										<UserDropdown user={session.user} />
									</div>
								) : null
							}
						/>
						{children}
						<footer className="campus-footer">{footer}</footer>
					</div>
				</main>
			</div>
		</div>
	);
}
