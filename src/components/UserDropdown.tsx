"use client";

import { saveUserLocale } from "@/app/actions";
import { Link } from "@/lib/navigation";
import { signOut } from "@/lib/auth-client";
import { useLocale, useTranslations } from "next-intl";
import {
	ChevronDown,
	Code2,
	Languages,
	LayoutList,
	LogOut,
	Monitor,
	Moon,
	Settings,
	Sun,
} from "lucide-react";
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
					<Sun className="w-4 h-4" aria-hidden="true" />
				);
			case "dark":
				return (
					<Moon className="w-4 h-4" aria-hidden="true" />
				);
			default:
				return (
					<Monitor className="w-4 h-4" aria-hidden="true" />
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
				<ChevronDown aria-hidden="true" />
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
							<LayoutList className="w-4 h-4" aria-hidden="true" />
							<span>{t("studentCard")}</span>
						</Link>
						<Link
							href="/settings"
							className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--foreground)] transition-colors"
							onClick={() => setIsOpen(false)}
						>
							<Settings className="w-4 h-4" aria-hidden="true" />
							<span>{t("settings")}</span>
						</Link>

						<Link
							href="/api"
							className="flex items-center gap-3 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-active)] hover:text-[var(--foreground)] transition-colors"
							onClick={() => setIsOpen(false)}
						>
							<Code2 className="w-4 h-4" aria-hidden="true" />
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
							<Languages className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" aria-hidden="true" />
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
							<LogOut className="w-4 h-4" aria-hidden="true" />
							<span>{t("logout")}</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
