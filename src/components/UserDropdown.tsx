"use client";

import { saveUserLocale } from "@/app/actions";
import { Link, useRouter } from "@/lib/navigation";
import { writeLocaleCookie } from "@/lib/locale-cookie";
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
	const router = useRouter();

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

	// The locale lives in a cookie, so the path never changes: write the
	// cookie, then re-render the current route through the server.
	const handleLocaleSwitch = (newLocale: "en" | "zh-HK") => {
		if (newLocale === locale) return;
		saveUserLocale(newLocale).catch(console.error);
		writeLocaleCookie(newLocale);
		router.refresh();
	};

	const getThemeIcon = () => {
		if (!mounted) return null;
		switch (theme) {
			case "light":
				return <Sun className="w-4 h-4" aria-hidden="true" />;
			case "dark":
				return <Moon className="w-4 h-4" aria-hidden="true" />;
			default:
				return <Monitor className="w-4 h-4" aria-hidden="true" />;
		}
	};

	return (
		<div className="user-menu" ref={dropdownRef}>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="user-menu-trigger"
				title="User menu"
				aria-expanded={isOpen}
				aria-haspopup="menu"
			>
				{user.image ? (
					<img
						src={user.image}
						alt={user.name || "User"}
						className="user-menu-avatar"
						width={28}
						height={28}
						referrerPolicy="no-referrer"
					/>
				) : (
					<span className="user-menu-avatar user-menu-avatar-fallback" aria-hidden="true">
						{user.name?.charAt(0).toUpperCase() || "U"}
					</span>
				)}
				<ChevronDown className="user-menu-chevron" aria-hidden="true" />
			</button>

			{isOpen && (
				<div className="user-menu-panel" role="menu">
					<div className="user-menu-head">
						<p className="user-menu-name">{user.name || "User"}</p>
						<p className="user-menu-caption">{t("settings")}</p>
					</div>

					<div className="user-menu-body">
						<Link
							href="/student-card"
							className="user-menu-item"
							role="menuitem"
							onClick={() => setIsOpen(false)}
						>
							<LayoutList className="w-4 h-4" aria-hidden="true" />
							<span>{t("studentCard")}</span>
						</Link>
						<Link
							href="/settings"
							className="user-menu-item"
							role="menuitem"
							onClick={() => setIsOpen(false)}
						>
							<Settings className="w-4 h-4" aria-hidden="true" />
							<span>{t("settings")}</span>
						</Link>

						<Link
							href="/api"
							className="user-menu-item"
							role="menuitem"
							onClick={() => setIsOpen(false)}
						>
							<Code2 className="w-4 h-4" aria-hidden="true" />
							<span>{t("apiPlayground")}</span>
						</Link>

						<button type="button" onClick={cycleTheme} className="user-menu-item" role="menuitem">
							{getThemeIcon()}
							<span className="flex-1 text-left">
								{t("theme")}: {mounted ? (theme === "system" ? t("system") : theme === "dark" ? t("dark") : t("light")) : "..."}
							</span>
						</button>

						<div className="user-menu-locale">
							<Languages className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" aria-hidden="true" />
							<span className="user-menu-locale-label">{t("language")}:</span>
							<div className="user-menu-locale-switch">
								<button
									type="button"
									onClick={() => handleLocaleSwitch("en")}
									className={locale === "en" ? "is-active" : undefined}
									aria-pressed={locale === "en"}
									aria-label="English"
								>
									EN
								</button>
								<button
									type="button"
									onClick={() => handleLocaleSwitch("zh-HK")}
									className={locale === "zh-HK" ? "is-active" : undefined}
									aria-pressed={locale === "zh-HK"}
									aria-label="繁體中文"
								>
									繁體
								</button>
							</div>
						</div>

						<div className="user-menu-divider" />

						<button
							type="button"
							onClick={async () => {
								await signOut();
								window.location.href = "/";
							}}
							className="user-menu-item is-danger"
							role="menuitem"
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
