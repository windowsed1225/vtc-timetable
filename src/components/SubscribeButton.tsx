"use client";

import { useState } from "react";

interface SubscribeButtonProps {
    discordId: string;
}

/**
 * Subscribe to Calendar Button
 * 
 * Generates a subscription URL for all calendar events.
 * 
 * SECURITY NOTE:
 * This URL is effectively a public link - anyone with the URL can view
 * the user's calendar events. This is the standard trade-off for calendar
 * subscription feeds since calendar apps cannot perform OAuth authentication.
 */
export default function SubscribeButton({ discordId }: SubscribeButtonProps) {
    const [copied, setCopied] = useState(false);
    const [showInstructions, setShowInstructions] = useState(false);

    const handleCopy = async () => {
        // Generate the subscription URL (all events, no semester filter)
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const subscriptionUrl = `${baseUrl}/api/calendar/${discordId}`;

        try {
            await navigator.clipboard.writeText(subscriptionUrl);
            setCopied(true);
            setShowInstructions(true);

            // Reset copied state after 3 seconds
            setTimeout(() => setCopied(false), 3000);
        } catch (error) {
            console.error("Failed to copy:", error);
            // Fallback: show the URL in an alert
            alert(`Copy this URL manually:\n${subscriptionUrl}`);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleCopy}
                className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                    />
                </svg>
                {copied ? "Link Copied!" : "Subscribe to Calendar"}
            </button>

            {/* Instructions Modal */}
            {showInstructions && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
                    onClick={() => setShowInstructions(false)}
                >
                    <div
                        className="bg-[var(--background)] rounded-2xl p-6 max-w-md mx-4 shadow-2xl animate-scaleIn"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="white"
                                    className="w-6 h-6"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m4.5 12.75 6 6 9-13.5"
                                    />
                                </svg>
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg">Link Copied!</h3>
                                <p className="text-sm text-[var(--text-secondary)]">
                                    Subscription URL is in your clipboard
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.03)]">
                                <p className="font-medium mb-2">📱 Apple Calendar</p>
                                <p className="text-[var(--text-secondary)]">
                                    File → New Calendar Subscription → Paste the link
                                </p>
                            </div>

                            <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.03)]">
                                <p className="font-medium mb-2">📅 Google Calendar</p>
                                <p className="text-[var(--text-secondary)]">
                                    Settings → Add Calendar → From URL → Paste the link
                                </p>
                            </div>

                            <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.03)] dark:bg-[rgba(255,255,255,0.03)]">
                                <p className="font-medium mb-2">📧 Outlook</p>
                                <p className="text-[var(--text-secondary)]">
                                    Add Calendar → Subscribe from web → Paste the link
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-[var(--text-tertiary)] mt-4">
                            ⚠️ Your calendar updates automatically every hour
                        </p>

                        <button
                            onClick={() => setShowInstructions(false)}
                            className="btn-primary w-full mt-4"
                        >
                            Got it!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
