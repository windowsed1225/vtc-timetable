"use client";

import { useEffect } from "react";
import { checkAndSyncBackground } from "@/app/actions";
import { useSession } from "next-auth/react";

/**
 * Component to trigger background synchronization when the user is logged in
 * This component doesn't render anything visible
 */
export default function BackgroundSync() {
    const { data: session } = useSession();

    useEffect(() => {
        if (session) {
            // Check and sync data if needed (more than 24h since last sync)
            checkAndSyncBackground().then(result => {
                if (result.success && result.newEvents !== undefined) {
                    console.log(`Background sync complete. Found ${result.newEvents} new events.`);
                }
            }).catch(err => {
                console.error("Background sync error:", err);
            });
        }
    }, [session]);

    return null;
}
