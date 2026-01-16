"use client";

import { useState, useEffect } from "react";

interface SyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSync: (url: string, semester: number) => Promise<void>;
    initialUrl?: string;
}

// Auto-detect semester based on current month
function getDefaultSemester(): number {
    const month = new Date().getMonth() + 1; // 1-12

    if (month >= 9 && month <= 12) {
        return 1; // Semester 1 (Sep-Dec)
    } else if (month >= 1 && month <= 4) {
        return 2; // Semester 2 (Jan-Apr)
    } else {
        return 3; // Summer (May-Aug)
    }
}

export default function SyncModal({
    isOpen,
    onClose,
    onSync,
    initialUrl = "",
}: SyncModalProps) {
    const [url, setUrl] = useState(initialUrl);
    const [semester, setSemester] = useState(getDefaultSemester());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-detect semester on mount
    useEffect(() => {
        setSemester(getDefaultSemester());
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) {
            setError("Please enter a VTC URL");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await onSync(url, semester);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to sync");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Sync Schedule</h2>
                    <button onClick={onClose} className="btn-icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18 18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            VTC API URL
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://mobile.vtc.edu.hk/api?...&token=YOUR_TOKEN"
                            className="input-apple"
                            autoFocus
                        />
                        <p className="text-xs text-[var(--text-tertiary)] mt-2">
                            Paste the URL from your VTC mobile app
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                            Semester
                        </label>
                        <div className="flex flex-col gap-2">
                            {[
                                { value: 1, label: "Semester 1", months: "Sep-Dec" },
                                { value: 2, label: "Semester 2", months: "Jan-Apr" },
                                { value: 3, label: "Summer", months: "May-Aug" },
                            ].map((s) => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setSemester(s.value)}
                                    className={`w-full py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${semester === s.value
                                        ? "bg-[var(--calendar-today)] text-white"
                                        : "bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.05)] text-[var(--foreground)] hover:bg-[rgba(0,0,0,0.06)]"
                                        }`}
                                >
                                    <span>{s.label}</span>
                                    <span className={`text-xs ${semester === s.value ? "text-white/80" : "text-[var(--text-tertiary)]"}`}>
                                        ({s.months})
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="btn-secondary flex-1">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary flex-1">
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Syncing...
                                </span>
                            ) : (
                                "Sync Now"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
