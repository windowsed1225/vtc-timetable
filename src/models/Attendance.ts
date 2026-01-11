import mongoose, { Schema, Document, Model } from "mongoose";

// Interface for individual class record
export interface IClassRecord {
    id: string;
    date: string;
    lessonTime: string;
    attendTime: string;
    roomName: string;
    status: "attended" | "late" | "absent";
}

// Interface for the Attendance document
export interface IAttendance extends Document {
    discordId: string; // Foreign key - links to User
    vtcStudentId: string; // Foreign key - VTC student ID
    courseCode: string;
    courseName: string;
    attendRate: number;
    totalClasses: number;
    conductedClasses: number;
    attended: number;
    late: number;
    absent: number;
    isFinished: boolean;
    isFollowUp: boolean;
    baseCourseCode: string;
    classes: IClassRecord[];
    createdAt: Date;
    updatedAt: Date;
}

// Schema definition
const AttendanceSchema = new Schema<IAttendance>(
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
        courseCode: {
            type: String,
            required: true,
            index: true,
        },
        courseName: {
            type: String,
            default: "",
        },
        attendRate: {
            type: Number,
            default: 0,
        },
        totalClasses: {
            type: Number,
            default: 0,
        },
        conductedClasses: {
            type: Number,
            default: 0,
        },
        attended: {
            type: Number,
            default: 0,
        },
        late: {
            type: Number,
            default: 0,
        },
        absent: {
            type: Number,
            default: 0,
        },
        isFinished: {
            type: Boolean,
            default: false,
        },
        isFollowUp: {
            type: Boolean,
            default: false,
        },
        baseCourseCode: {
            type: String,
            default: "",
        },
        classes: [
            {
                id: String,
                date: String,
                lessonTime: String,
                attendTime: String,
                roomName: String,
                status: {
                    type: String,
                    enum: ["attended", "late", "absent"],
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

// Unique compound index - one attendance record per course per user
AttendanceSchema.index({ courseCode: 1, discordId: 1 }, { unique: true });

// Prevent model overwrite in development (hot reload)
const Attendance: Model<IAttendance> =
    mongoose.models.Attendance ||
    mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;
