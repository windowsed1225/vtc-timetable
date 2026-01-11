import mongoose, { Schema, Document, Model } from "mongoose";

// Interface for the Event document
export interface IEvent extends Document {
    discordId: string; // Foreign key - links to User
    vtcStudentId: string; // Foreign key - VTC student ID
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

// Unique compound index - same event for different users is allowed
EventSchema.index({ vtc_id: 1, discordId: 1 }, { unique: true });

// Prevent model overwrite in development (hot reload)
const Event: Model<IEvent> =
    mongoose.models.Event || mongoose.model<IEvent>("Event", EventSchema);

export default Event;
