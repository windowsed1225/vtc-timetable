"use client";

import SessionSplash from "@/components/SessionSplash";
import { useSession } from "@/lib/auth-client";
import dynamic from "next/dynamic";

const LandingPage = dynamic(() => import("@/components/landing/LandingPage"), {
	loading: () => <SessionSplash />,
});
const AuthenticatedHome = dynamic(() => import("@/components/AuthenticatedHome"), {
	loading: () => <SessionSplash />,
});

interface TimetableRouteProps {
	/** "home" is `/`, the at-a-glance dashboard. "timetable" is `/timetable`. */
	mode?: "home" | "timetable";
}

/** Signed-out visitors get the landing page; signed-in ones get their workspace. */
export default function TimetableRoute({ mode = "home" }: TimetableRouteProps) {
	const { data: session, isPending } = useSession();
	if (isPending) return <SessionSplash />;
	if (!session) return <LandingPage />;
	return <AuthenticatedHome mode={mode} />;
}
