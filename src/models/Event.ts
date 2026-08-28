import mongoose, { Schema, Document, Model } from "mongoose";

import { normalizeSemester, SEMESTER_NUMBERS, type SemesterType } from "@/lib/semester";
export type { SemesterType };

// Status type
export type EventStatusType = "UPCOMING" | "FINISHED" | "CANCELED" | "RESCHEDULED" | "ABSENT";

export interface IEvent extends Document {
    vtcStudentId: string;
    semester: SemesterType;
    status: EventStatusType;
    vtc_id: string;
    courseCode: string;
    courseTitle: string;
    lessonType: string;
    startTime: Date;
    endTime: Date;
    scheduledStartTime?: Date;
    scheduledEndTime?: Date;
    scheduledDuration?: number;
    actualDuration?: number;
    isTimeAdjusted: boolean;
    attendanceStatusCode?: number | null;
    location: string;
    lecturerName: string;
    colorIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
    {
        vtcStudentId: {
            type: String,
            required: true,
            index: true,
        },
        semester: {
            type: Number,
            required: true,
            enum: [...SEMESTER_NUMBERS],
            index: true,
            set: (value: unknown) => normalizeSemester(value) ?? value,
            get: (value: unknown) => normalizeSemester(value) ?? value,
        },
        status: {
            type: String,
            default: "UPCOMING",
            enum: ["UPCOMING", "FINISHED", "CANCELED", "RESCHEDULED", "ABSENT"],
            index: true,
        },
        vtc_id: {
            type: String,
            required: true,
            index: true,
        },
        courseCode: {
            type: String,
            required: true,
            index: true,
        },
        courseTitle: {
            type: String,
            required: true,
        },
        lessonType: {
            type: String,
            default: "",
        },
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
            required: true,
        },
        scheduledStartTime: {
            type: Date,
        },
        scheduledEndTime: {
            type: Date,
        },
        scheduledDuration: {
            type: Number,
        },
        actualDuration: {
            type: Number,
        },
        isTimeAdjusted: {
            type: Boolean,
            default: false,
        },
        attendanceStatusCode: {
            type: Number,
            default: null,
        },
        location: {
            type: String,
            default: "",
        },
        lecturerName: {
            type: String,
            default: "",
        },
        colorIndex: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

EventSchema.index({ vtc_id: 1, vtcStudentId: 1, semester: 1 }, { unique: true });
EventSchema.index({ vtcStudentId: 1, startTime: 1 });
EventSchema.index({ vtcStudentId: 1, courseCode: 1, status: 1 });
EventSchema.index({ vtcStudentId: 1, courseCode: 1, semester: 1, startTime: 1 });

const Event: Model<IEvent> =
    mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
