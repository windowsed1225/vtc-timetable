/**
 * Extracts the token from a VTC API URL
 * @param urlString The full URL containing the token parameter
 * @returns The token string if found, null otherwise
 */
export function getTokenFromUrl(urlString: string): string | null {
    try {
        const url = new URL(urlString);
        return url.searchParams.get("token");
    } catch (error) {
        console.error("Invalid URL provided", error);
        return null;
    }
}

/**
 * Converts Unix timestamp (seconds) to a date array for ICS format
 * @param timestamp Unix timestamp in seconds
 * @returns Array of [year, month, day, hour, minute]
 */
export function getDateArray(timestamp: number): [number, number, number, number, number] {
    const date = new Date(timestamp * 1000);
    return [
        date.getFullYear(),
        date.getMonth() + 1, // ICS months are 1-indexed
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
    ];
}
