import { getClassAttendanceDetail } from "../types/getClassAttendanceDetail";
import { getClassAttendanceList } from "../types/getClassAttendanceList";
import { getTimeTableAndReminderList } from "../types/getTimeTableAndReminderList";
import { getMoodleTimetable } from '../types/getMoodleTimetable';
import { userResponse } from '../types/user';

export class API {
    private url;
    private token;
    constructor({ token }: { token: string }) {
        this.url = "https://mobile.vtc.edu.hk/api?"
        this.token = token
    }
    /**
    * Retrieves the class attendance detail from the VTC mobile API.
     */
    async getClassAttendanceDetail(courseCode: string): Promise<getClassAttendanceDetail> {
        const response = await fetch(`${this.url}cmd=getClassAttendanceDetail&token=${this.token}&courseCode=${courseCode}`, {
            method: "GET",
        })
        return response.json()
    }

    /**
     * Retrieves the class attendance list from the VTC mobile API.
     */
    async getClassAttendanceList(): Promise<getClassAttendanceList> {
        const response = await fetch(`${this.url}cmd=getClassAttendanceList&token=${this.token}`, {
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
        const response = await fetch(`${this.url}cmd=getTimeTableAndReminderList&token=${this.token}&month=${month}&year=${year}`, {
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
        const response = await fetch(`${this.url}cmd=getMoodleTimetable&token=${this.token}&isPlural=${isPlural}&month=${month}&year=${year}`, {
            method: "GET",
        })
        return response.json()
    }

    async checkAccessToken(): Promise<userResponse> {
        const response = await fetch(`${this.url}cmd=checkAccessToken&token=${this.token}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
        return response.json()
    }
}