import mongoose, { Schema, Document, Model } from "mongoose";

// Semester type
export type SemesterType = "SEM 1" | "SEM 2" | "SEM 3";

// Status type
export type EventStatusType = "UPCOMING" | "FINISHED" | "CANCELED" | "RESCHEDULED";

// Interface for the Event document
export interface IEvent extends Document {
    discordId: string; // Foreign key - links to User
    vtcStudentId: string; // Foreign key - VTC student ID
    semester: SemesterType; // Semester category
    status: EventStatusType; // Event status
    vtc_id: string;
    courseCode: string;
    courseTitle: string;
    lessonType: string;
    startTime: Date;
    endTime: Date;
    location: string;
    lecturerName: string;
    colorIndex: number;
    createdAt: Date;
    updatedAt: Date;
}

// Schema definition
const EventSchema = new Schema<IEvent>(
    {
        discordId: {
            type: String,
            required: true,
            index: true,
        },
        vtcStudentId: {
            type: String,
            required: true,
            index: true,
        },
        semester: {
            type: String,
            required: true,
            enum: ["SEM 1", "SEM 2", "SEM 3"],
            index: true,
        },
        status: {
            type: String,
            default: "UPCOMING",
            enum: ["UPCOMING", "FINISHED", "CANCELED", "RESCHEDULED"],
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
        timestamps: true, // Adds createdAt and updatedAt
    }
);

// Unique compound index - same event for different users/semesters is allowed
EventSchema.index({ vtc_id: 1, discordId: 1, semester: 1 }, { unique: true });

// Prevent model overwrite in development (hot reload)
const Event: Model<IEvent> =
    mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
