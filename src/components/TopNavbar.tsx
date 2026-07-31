"use client";

import { useSession } from "@/lib/auth-client";
import Image from "next/image";
import type { ReactNode } from "react";
import UserDropdown from "./UserDropdown";

interface TopNavbarProps {
	onSignIn: () => void;
	onSidebarToggle: () => void;
	sidebarOpen: boolean;
	actions?: ReactNode;
}

export default function TopNavbar({ onSignIn, onSidebarToggle, sidebarOpen, actions }: TopNavbarProps) {
	const { data: session } = useSession();

	return (
		<nav className="top-navbar" aria-label="Application navigation">
			<div className="flex items-center gap-3 min-w-0">
				<button className="top-navbar-hamburger" onClick={onSidebarToggle} aria-label="Toggle sidebar">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
						{sidebarOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />}
					</svg>
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
			{actions && <div className="top-navbar-actions">{actions}</div>}

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
