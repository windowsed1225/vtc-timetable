"use client";

import { SessionProvider } from "next-auth/react";
import BackgroundSync from "./BackgroundSync";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <BackgroundSync />
            {children}
        </SessionProvider>
    );
}
