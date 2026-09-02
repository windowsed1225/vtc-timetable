"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";

interface TopNavbarProps {
	onSidebarToggle: () => void;
	sidebarOpen: boolean;
}

// Compact chrome for viewports without the persistent sidebar. The account menu
// and calendar tools live in the page header (DashboardOverview) at every width,
// so this bar only carries the drawer toggle and the brand lockup.
export default function TopNavbar({ onSidebarToggle, sidebarOpen }: TopNavbarProps) {
	return (
		<nav className="top-navbar" aria-label="Application navigation">
			<div className="flex items-center gap-3 min-w-0">
				<button className="top-navbar-hamburger" onClick={onSidebarToggle} aria-label="Toggle sidebar">
					{sidebarOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
				</button>

				<div className="top-navbar-brand">
					<Image src="/vtc-timetable.svg" alt="" width={34} height={34} className="top-navbar-logo" priority />
					<div className="min-w-0">
						<span className="top-navbar-title hidden sm:block">VTC Timetable</span>
						<span className="top-navbar-title sm:hidden">Timetable</span>
						<span className="top-navbar-subtitle hidden md:block">Vocational Training Council</span>
					</div>
				</div>
			</div>
		</nav>
	);
}
