"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import UserDropdown from "./UserDropdown";

interface TopNavbarProps {
	onSidebarToggle: () => void;
	sidebarOpen: boolean;
	/** Signed-in account. On phone the avatar lives here; desktop keeps it in the page header. */
	user?: {
		name?: string | null;
		image?: string | null;
	} | null;
}

// Compact chrome: drawer toggle + brand on the left. Phone also gets the account
// menu on the right so it stays out of the stacked greeting row.
export default function TopNavbar({ onSidebarToggle, sidebarOpen, user }: TopNavbarProps) {
	return (
		<nav className="top-navbar" aria-label="Application navigation">
			<div className="top-navbar-start">
				<button type="button" className="top-navbar-hamburger" onClick={onSidebarToggle} aria-label="Toggle sidebar">
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

			{user ? (
				<div className="top-navbar-end">
					<UserDropdown user={user} />
				</div>
			) : null}
		</nav>
	);
}
