"use client";

import { ThemeProvider } from "next-themes";
import BackgroundSync from "./BackgroundSync";

// better-auth's useSession reads from its own store and needs no context provider.
export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <BackgroundSync />
            {children}
        </ThemeProvider>
    );
}
