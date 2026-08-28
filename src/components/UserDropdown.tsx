"use client";

import { saveUserLocale } from "@/app/actions";
import { Link } from "@/lib/navigation";
import { signOut } from "@/lib/auth-client";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

interface UserDropdownProps {
	user: {
		name?: string | null;
		image?: string | null;
	};
}

export default function UserDropdown({ user }: UserDropdownProps) {
	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef<HTMLDivElement>(null);
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	const t = useTranslations("settings");
	const locale = useLocale();

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const cycleTheme = () => {
		if (!mounted) return;
		const themes = ["light", "dark", "system"];
		const currentIndex = themes.indexOf(theme || "system");
		setTheme(themes[(currentIndex + 1) % themes.length]);
	};

	const handleLocaleSwitch = async (newLocale: "en" | "zh-HK") => {
		if (newLocale === locale) return;
		saveUserLocale(newLocale).catch(console.error);
		// Strip the current locale prefix from the path, then navigate
		const currentPath = window.location.pathname;
		const stripped = currentPath.replace(/^\/(en|zh-HK)/, "") || "/";
		window.location.href = `/${newLocale}${stripped}`;
	};

	const getThemeIcon = () => {
		if (!mounted) return null;
		switch (theme) {
			case "light":
				return (
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
						<path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
					</svg>
				);
			case "dark":
				return (
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
						<path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
					</svg>
				);
			default:
				return (
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
					</svg>
				);
		}
	};

	return (
		<div className="relative" ref={dropdownRef}>
			{/* Avatar Button */}
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="flex items-center gap-2 p-1 rounded-lg hover:bg-[var(--bg-active)] transition-colors"
				title="User menu"
				aria-expanded={isOpen}
			>
				{user.image ? (
					<img
						src={user.image}
						alt={user.name || "User"}
						className="w-7 h-7 rounded-full ring-1 ring-border-strong"
					/>
				) : (
					<div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
						<span className="text-white font-semibold text-xs">
							{user.name?.charAt(0).toUpperCase() || "U"}
						</span>
					</div>
				)}
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
					className={`w-3 h-3 text-[var(--text-tertiary)] transition-transform ${isOpen ? "rotate-180" : ""}`}>
					<path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
				</svg>
			</button>

			{/* Dropdown Menu */}
			{isOpen && (
				<div className="absolute right-0 mt-2 w-56 bg-[var(--bg-surface)] rounded-xl shadow-lg border border-border py-1 z-50 animate-fadeIn">
					<div className="px-4 py-3 border-b border-border">
						<p className="text-sm font-semibold text-[var(--foreground)] truncate">
							{user.name || "User"}
						</p>
						<p className="text-xs text-[var(--text-tertiary)]">{t("settings")}</p>
					</div>

					<div className="py-1">
						<Link
							href="/student-card"
							className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--foreground)] transition-colors"
							onClick={() => setIsOpen(false)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.665 6.721 6.721 0 0 1-3.168-.665 3.066 3.066 0 0 1 6.338 0Z" />
							</svg>
							<span>{t("studentCard")}</span>
						</Link>
						<Link
							href="/settings"
							className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--foreground)] transition-colors"
							onClick={() => setIsOpen(false)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
							</svg>
							<span>{t("settings")}</span>
						</Link>

						<Link
							href="/api"
							className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--foreground)] transition-colors"
							onClick={() => setIsOpen(false)}
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
							</svg>
							<span>{t("apiPlayground")}</span>
						</Link>

						{/* Theme Toggle */}
						<button
							onClick={cycleTheme}
							className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--foreground)] transition-colors"
						>
							{getThemeIcon()}
							<span className="flex-1 text-left">
								{t("theme")}: {mounted ? (theme === "system" ? t("system") : theme === "dark" ? t("dark") : t("light")) : "..."}
							</span>
						</button>

						{/* Language Toggle */}
						<div className="flex items-center gap-3 px-4 py-2">
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[var(--text-tertiary)] shrink-0">
								<path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
							</svg>
							<span className="text-sm text-[var(--text-secondary)] flex-1">{t("language")}:</span>
							<div className="flex rounded-lg overflow-hidden border border-border-strong">
								<button
									onClick={() => handleLocaleSwitch("en")}
									className={`px-2.5 py-1 text-xs font-medium transition-colors ${locale === "en"
										? "bg-[var(--accent-blue)] text-white"
										: "text-[var(--text-secondary)] hover:bg-[var(--bg-active)]"
										}`}
								>
									EN
								</button>
								<button
									onClick={() => handleLocaleSwitch("zh-HK")}
									className={`px-2.5 py-1 text-xs font-medium transition-colors border-l border-border-strong ${locale === "zh-HK"
										? "bg-[var(--accent-blue)] text-white"
										: "text-[var(--text-secondary)] hover:bg-[var(--bg-active)]"
										}`}
								>
									繁體
								</button>
							</div>
						</div>

						{/* Divider */}
						<div className="my-1 border-t border-border" />

						{/* Logout */}
						<button
							onClick={async () => {
								await signOut();
								window.location.href = "/";
							}}
							className="w-full flex items-center gap-3 px-4 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-bg)] transition-colors"
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
								<path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
							</svg>
							<span>{t("logout")}</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
