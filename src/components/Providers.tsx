"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import BackgroundSync from "./BackgroundSync";

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
                <BackgroundSync />
                {children}
            </ThemeProvider>
        </SessionProvider>
    );
}
