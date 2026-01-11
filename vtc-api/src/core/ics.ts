import * as ics from 'ics';
import { combinedData } from "../types/combined";
import fs from "node:fs/promises";
export class Icsgenerator {
    convertTimestampToICSDate(timestamp: number): [number, number, number, number, number] {
        const date = new Date(timestamp * 1000)
        return [
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getHours(),
            date.getMinutes()
        ]
    }
    calculateDuration(start: number, end: number) {
        const diff = end - start
        const hours = Math.floor(diff / 3600)
        const minutes = Math.floor((diff % 3600) / 60)
        return { hours, minutes }
    }
    generateIcsFiles(data: combinedData[], semster: number) {
        return new Promise((resolve, reject) => {
            const events = data.map((item) => {
                return {
                    title: `${item.courseTitle} - ${item.courseCode}`,
                    location: item.roomNum,
                    status: "CONFIRMED",
                    description: `Instructor: ${item.lecturerName}\nRoom: ${item.roomNum}\nTime: ${new Date(item.startTime * 1000).toLocaleString()} - ${new Date(item.endTime * 1000).toLocaleString()}`,
                    start: this.convertTimestampToICSDate(Number(item.startTime)),
                    duration: this.calculateDuration(
                        Number(item.startTime),
                        Number(item.endTime)
                    ),
                    categories: ['Class'],
                } as ics.EventAttributes;
            });
            ics.createEvents(events, (error, value) => {
                if (error) {
                    console.log(error);
                    reject(error);
                }
                fs.writeFile(`semester_${semster}_classes.ics`, value);
                resolve(value);
            });
        });
    }
}