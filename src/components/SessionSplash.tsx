"use client";

// Full-screen placeholder shown while the auth session resolves.
// Rendered identically on the server and first client paint, so neither the
// landing page nor the app shell flashes for the "wrong" audience.
export default function SessionSplash() {
	return (
		<div className="h-screen flex items-center justify-center bg-[var(--background)]">
			<div
				className="w-6 h-6 rounded-full animate-pulse"
				style={{ background: "var(--bg-surface)", border: "5px solid var(--accent)" }}
				aria-label="Loading"
			/>
		</div>
	);
}
