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

export default function Home() {
    const { data: session, isPending } = useSession();
    if (isPending) return <SessionSplash />;
    if (!session) return <LandingPage />;
    return <AuthenticatedHome />;
}
