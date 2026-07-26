import { getClassAttendanceDetail } from "../types/getClassAttendanceDetail";
import { getClassAttendanceList } from "../types/getClassAttendanceList";
import { getTimeTableAndReminderList } from "../types/getTimeTableAndReminderList";
import { getMoodleTimetable } from '../types/getMoodleTimetable';
import { getPrintQuota } from "../types/getPrintQuota";
import { ecardRegister } from "../types/ecardRegister";
import { userResponse } from '../types/user';

/** Uppercase UUID for ecard deviceID query param (matches VTC app style). */
export function randomEcardDeviceId(): string {
    return crypto.randomUUID().toUpperCase();
}

export class API {
    private url;
    private ecardUrl;
    private token;
    constructor({ token }: { token: string }) {
        this.url = "https://mobile.vtc.edu.hk/api?cmd="
        this.ecardUrl = "https://ecard-api.vtc.edu.hk/v1"
        this.token = token
    }
    /**
    * Retrieves the class attendance detail from the VTC mobile API.
     */
    async getClassAttendanceDetail(courseCode: string): Promise<getClassAttendanceDetail> {
        const response = await fetch(`${this.url}getClassAttendanceDetail&token=${this.token}&courseCode=${courseCode}`, {
            method: "GET",
        })
        return response.json()
    }

    /**
     * Retrieves the class attendance list from the VTC mobile API.
     */
    async getClassAttendanceList(): Promise<getClassAttendanceList> {
        const response = await fetch(`${this.url}getClassAttendanceList&token=${this.token}`, {
            method: "GET",
        })
        return response.json()
    }
    /**
     * Retrieves the timetable and reminder list for a specified month and year.
     * 
     * @param month - The month number (1-12) for which to retrieve the timetable
     * @param year - The year for which to retrieve the timetable
     * @returns A promise that resolves to the parsed JSON response containing the timetable and reminder list
     * @throws May throw an error if the fetch request fails or if the response cannot be parsed as JSON
     */
    async getTimeTableAndReminderList(month: number = 1, year: number = 2026): Promise<getTimeTableAndReminderList> {
        const response = await fetch(`${this.url}getTimeTableAndReminderList&token=${this.token}&month=${month}&year=${year}`, {
            method: "GET",
        })
        return response.json()
    }

    /**
     * Retrieves the Moodle timetable for a specified period.
     * 
     * @param isPlural - Indicates whether to retrieve plural timetable data (default: 1)
     * @param month - The month for which to retrieve the timetable (default: 1)
     * @param year - The year for which to retrieve the timetable (default: 2026)
     * @returns A promise that resolves to a getMoodleTimetable object containing the timetable data
     * @throws May throw an error if the fetch request fails or if the response cannot be parsed as JSON
     */
    async getMoodleTimetable(isPlural: number = 1, month: number = 1, year: number = 2026): Promise<getMoodleTimetable> {
        const response = await fetch(`${this.url}getMoodleTimetable&token=${this.token}&isPlural=${isPlural}&month=${month}&year=${year}`, {
            method: "GET",
        })
        return response.json()
    }

    /**
     * Retrieves the campus print quota for the authenticated student.
     * Payload includes campus, remaining balance, status, and lastUpdatedTime.
     */
    async getPrintQuota(): Promise<getPrintQuota> {
        const response = await fetch(`${this.url}getPrintQuota&token=${this.token}`, {
            method: "GET",
        })
        return response.json()
    }

    /**
     * Registers / opens an ecard session against ecard-api.vtc.edu.hk.
     * Uses the mobile VTC token as the Authorization header.
     * Generates a random deviceID unless one is provided.
     *
     * @returns API body plus the deviceId that was sent (needed for later ecard calls).
     */
    async registerEcard(deviceId?: string): Promise<ecardRegister & { deviceId: string }> {
        const id = (deviceId ?? randomEcardDeviceId()).toUpperCase();
        const response = await fetch(
            `${this.ecardUrl}/register?deviceID=${encodeURIComponent(id)}`,
            {
                method: "GET",
                headers: {
                    Authorization: this.token,
                },
            },
        );
        const body = (await response.json()) as ecardRegister;
        return { ...body, deviceId: id };
    }

    async checkAccessToken(): Promise<userResponse> {
        const response = await fetch(`${this.url}checkAccessToken&token=${this.token}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        return response.json()
    }
}