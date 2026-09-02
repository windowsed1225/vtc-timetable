"use client";

import { useEffect, useState } from "react";

/**
 * Current wall-clock time, re-read on an interval so "today", "next class" and
 * the greeting stay correct on a tab left open across a class boundary. Reading
 * the clock during render would make the output unstable, so the value is held
 * in state and only ever advanced from an effect.
 */
export function useNow(intervalMs = 60_000): Date {
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), intervalMs);
		return () => clearInterval(timer);
	}, [intervalMs]);

	return now;
}
