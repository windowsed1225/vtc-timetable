// Course "line" colors — HK transit signage palette.
// Mirrors the --line-0..9 CSS variables in src/app/globals.css; keep both in sync.
// NOTE: colorIndex is persisted per event (see actions/sync.ts), so the hash in
// getColorIndex must never change — only the hex values may be retuned.
export const LINE_COLORS = [
    "#E2231A", // Red
    "#0860A8", // Island Blue
    "#00A040", // Green
    "#7D2882", // Purple
    "#9A3B26", // Maroon
    "#53B7E8", // Light Blue
    "#8FAF12", // Lime
    "#F7943E", // Orange
    "#007A87", // Teal
    "#EF5FA7", // Pink
];

// Generate consistent color index from course code
export function getColorIndex(courseCode: string): number {
    let hash = 0;
    for (let i = 0; i < courseCode.length; i++) {
        const char = courseCode.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash) % LINE_COLORS.length;
}
