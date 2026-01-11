import * as fs from "node:fs/promises";
import { API } from "./api";

const SEMESTER_MAP: Record<number, number[]> = {
    1: [9, 10, 11, 12],
    2: [1, 2, 3, 4],
    3: [5, 6, 7, 8]
};
const lectureCodeSet: Set<string> = new Set();
export async function semster_timetable(client: API, semesterNum: number) {
    const months = SEMESTER_MAP[semesterNum];
    if (!months) throw new Error("Invalid semester number. Use 1, 2, or 3.");

    let lectureList = [];
    const currentYear = new Date().getFullYear(); // 2026

    for (const month of months) {
        // Logic: 
        // If we are looking for Sem 1 (Sept-Dec) while in Jan 2026, we likely want 2025.
        // If we are looking for Sem 2 (Jan-Apr) while in Jan 2026, we want 2026.

        let effectiveYear = currentYear;

        if (semesterNum === 1 && [9, 10, 11, 12].includes(month)) {
            // Semester 1 usually belongs to the previous calendar year 
            // relative to the "current" Spring semester.
            effectiveYear = currentYear - 1;
        }

        console.log(`Fetching Semester ${semesterNum}: Month ${month}, Year ${effectiveYear}`);

        try {
            const timetable = await client.getTimeTableAndReminderList(month, effectiveYear);
            const rawList = timetable.payload?.timetable?.add || [];
            lectureList.push(...rawList);

            await fs.writeFile(
                `./data/timetable_${effectiveYear}_${month}.json`,
                JSON.stringify(timetable, null, 2)
            );


        } catch (err: any) {
            console.error(`Error processing month ${month}:`, err.message);
        }
    }

    await fs.writeFile(
        `./data/semester_${semesterNum}_combined.json`,
        JSON.stringify(lectureList, null, 2)
    );
    return { lectureList, legnth: lectureList.length }
}
/**
 * Extracts the 'token' query parameter from a full URL string.
 * @param urlString - The full URL (e.g., https://mobile.vtc.edu.hk/api?cmd=...&token=...)
 * @returns The token string if found, otherwise null.
 */
function getTokenFromUrl(urlString: string): string | null {
    try {
        const url = new URL(urlString);
        return url.searchParams.get("token");
    } catch (error) {
        console.error("Invalid URL provided", error);
        return null;
    }
}