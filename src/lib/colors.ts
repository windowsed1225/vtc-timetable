// Pastel colors for Apple iCloud Calendar style
export const PASTEL_COLORS = [
    "#FF6B6B", // Coral
    "#4ECDC4", // Teal
    "#45B7D1", // Sky Blue
    "#96CEB4", // Sage
    "#FFEAA7", // Lemon
    "#DDA0DD", // Plum
    "#98D8C8", // Mint
    "#F7DC6F", // Gold
    "#74B9FF", // Light Blue
    "#FD79A8", // Pink
];

// Generate consistent color index from course code
export function getColorIndex(courseCode: string): number {
    let hash = 0;
    for (let i = 0; i < courseCode.length; i++) {
        const char = courseCode.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % PASTEL_COLORS.length;
}
