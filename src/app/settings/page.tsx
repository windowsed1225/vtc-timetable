"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUserSettings, updateEmailPassword, updateGracePeriod } from "@/app/actions/settings";
import Link from "next/link";

export default function SettingsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<{
        email?: string;
        hasPassword: boolean;
        authProviders: string[];
        attendanceGracePeriod: number;
        discordUsername?: string;
        vtcStudentId?: string;
    } | null>(null);

    // Email/Password form state
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [emailPasswordLoading, setEmailPasswordLoading] = useState(false);
    const [emailPasswordMessage, setEmailPasswordMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    // Grace period state
    const [gracePeriod, setGracePeriod] = useState(10);
    const [gracePeriodLoading, setGracePeriodLoading] = useState(false);
    const [gracePeriodMessage, setGracePeriodMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);

    // Student ID visibility state
    const [isStudentIdVisible, setIsStudentIdVisible] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        const result = await getUserSettings();
        if (result.success && result.data) {
            setSettings(result.data);
            setEmail(result.data.email || "");
            setGracePeriod(result.data.attendanceGracePeriod);
        }
        setLoading(false);
    };

    const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailPasswordMessage(null);

        // Validation
        if (!email || !password) {
            setEmailPasswordMessage({ type: "error", text: "Email and password are required." });
            return;
        }

        if (password !== confirmPassword) {
            setEmailPasswordMessage({ type: "error", text: "Passwords do not match." });
            return;
        }

        setEmailPasswordLoading(true);
        const result = await updateEmailPassword(email, password);
        setEmailPasswordLoading(false);

        if (result.success) {
            setEmailPasswordMessage({ type: "success", text: "Email and password updated successfully!" });
            setPassword("");
            setConfirmPassword("");
            loadSettings(); // Reload to update hasPassword status
        } else {
            setEmailPasswordMessage({ type: "error", text: result.error || "Failed to update." });
        }
    };

    const handleGracePeriodSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setGracePeriodMessage(null);

        setGracePeriodLoading(true);
        const result = await updateGracePeriod(gracePeriod);
        setGracePeriodLoading(false);

        if (result.success) {
            setGracePeriodMessage({ type: "success", text: "Grace period updated successfully!" });
            loadSettings();
        } else {
            setGracePeriodMessage({ type: "error", text: result.error || "Failed to update." });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                            </svg>
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="container mx-auto px-6 py-8 max-w-4xl">
                {/* User Info Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Account Information</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Discord Username:</span>
                            <span className="font-medium text-gray-800 dark:text-white">{settings?.discordUsername || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400">VTC Student ID:</span>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800 dark:text-white font-mono">
                                    {settings?.vtcStudentId
                                        ? isStudentIdVisible
                                            ? settings.vtcStudentId
                                            : "•".repeat(settings.vtcStudentId.length)
                                        : "Not synced"}
                                </span>
                                {settings?.vtcStudentId && (
                                    <button
                                        type="button"
                                        onClick={() => setIsStudentIdVisible(!isStudentIdVisible)}
                                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                        aria-label={isStudentIdVisible ? "Hide Student ID" : "Show Student ID"}
                                    >
                                        {isStudentIdVisible ? (
                                            // Eye Off icon (slashed) - click to hide
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                                            </svg>
                                        ) : (
                                            // Eye icon (open) - click to reveal
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex justify-between items-start">
                            <span className="text-gray-600 dark:text-gray-400">Login Methods:</span>
                            <div className="flex flex-wrap gap-2 justify-end">
                                {settings?.authProviders && settings.authProviders.length > 0 ? (
                                    settings.authProviders.map((provider) => (
                                        <span
                                            key={provider}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg"
                                        >
                                            {provider === "discord" && (
                                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                                </svg>
                                            )}
                                            {provider === "credentials" && (
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                                                </svg>
                                            )}
                                            <span className="capitalize">
                                                {provider === "credentials" ? "Email & Password" : provider}
                                            </span>
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-sm text-gray-500 dark:text-gray-400">None</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Security</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        {settings?.hasPassword
                            ? "Your account has email/password login enabled. You can update your password below."
                            : "Set an email and password to enable alternative login method alongside Discord."}
                    </p>

                    <form onSubmit={handleEmailPasswordSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 dark:text-white"
                                placeholder="your.email@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Password {settings?.hasPassword && "(New Password)"}
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 dark:text-white"
                                placeholder="At least 8 characters"
                                minLength={8}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-800 dark:text-white"
                                placeholder="Re-enter password"
                                required
                            />
                        </div>

                        {emailPasswordMessage && (
                            <div className={`p-4 rounded-lg ${emailPasswordMessage.type === "success" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`}>
                                {emailPasswordMessage.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={emailPasswordLoading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {emailPasswordLoading ? "Saving..." : settings?.hasPassword ? "Update Password" : "Set Password"}
                        </button>
                    </form>
                </div>

                {/* Attendance Preferences Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Attendance Preferences</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Customize how your attendance is calculated based on arrival time tolerance.
                    </p>

                    <form onSubmit={handleGracePeriodSubmit} className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Grace Period
                                </label>
                                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {gracePeriod} min
                                </span>
                            </div>

                            <input
                                type="range"
                                min="0"
                                max="60"
                                step="5"
                                value={gracePeriod}
                                onChange={(e) => setGracePeriod(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />

                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                                <span>0 min</span>
                                <span>30 min</span>
                                <span>60 min</span>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                                How it works
                            </h3>
                            <p className="text-sm text-blue-800 dark:text-blue-400 mb-3">
                                If you arrive within <strong>{gracePeriod} minutes</strong> of the class start time, you'll be marked as <strong>Present</strong> instead of Absent.
                            </p>
                            <div className="bg-white dark:bg-gray-800 rounded-md p-3 text-sm">
                                <p className="text-gray-700 dark:text-gray-300 mb-1">
                                    <strong>Example:</strong> Class starts at 9:00 AM
                                </p>
                                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                                    <li>✅ Arrive at 9:{gracePeriod.toString().padStart(2, "0")} AM or earlier = <strong className="text-green-600">Present</strong></li>
                                    <li>❌ Arrive after 9:{gracePeriod.toString().padStart(2, "0")} AM = <strong className="text-red-600">Absent</strong></li>
                                </ul>
                            </div>
                        </div>

                        {gracePeriodMessage && (
                            <div className={`p-4 rounded-lg ${gracePeriodMessage.type === "success" ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"}`}>
                                {gracePeriodMessage.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={gracePeriodLoading}
                            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {gracePeriodLoading ? "Saving..." : "Save Grace Period"}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}
