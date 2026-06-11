"use client";

import { useSession } from "@/lib/auth-client";
import UserDropdown from "./UserDropdown";

interface TopNavbarProps {
	onSignIn: () => void;
	onSidebarToggle: () => void;
	sidebarOpen: boolean;
}

export default function TopNavbar({ onSignIn, onSidebarToggle, sidebarOpen }: TopNavbarProps) {
	const { data: session } = useSession();

	return (
		<nav className="top-navbar">
			{/* Left — Hamburger + Logo */}
			<div className="flex items-center gap-3">
				<button className="top-navbar-hamburger" onClick={onSidebarToggle} aria-label="Toggle sidebar">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
						{sidebarOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
					</svg>
				</button>

				<div className="flex items-center gap-2">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[var(--accent-blue)]">
						<path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
					</svg>
					<span className="text-sm font-semibold tracking-tight hidden sm:inline">Vocational Training Council Timetable (made with ❤️)</span>
					<span className="text-sm font-semibold tracking-tight sm:hidden">VTC Timetable ❤️</span>
				</div>
			</div>

			{/* Right — User Dropdown */}
			<div className="flex items-center gap-2">
				{session?.user ? (
					<UserDropdown user={session.user} />
				) : (
					<button onClick={onSignIn} className="btn-primary text-xs px-3 py-1.5">
						Sign In
					</button>
				)}
			</div>
		</nav>
	);
}
