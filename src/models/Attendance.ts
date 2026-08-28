import mongoose, { Schema, Document, Model } from "mongoose";

// Semester type
export type SemesterType = "SEM 1" | "SEM 2" | "SEM 3";

// Attendance status type
export type AttendanceStatusType = "ACTIVE" | "FINISHED";

// Interface for individual class record
export interface IClassRecord {
    id: string;
    date: string;
    lessonTime: string;
    attendTime: string;
    roomName: string;
    actualDuration?: number;
    status: "attended" | "late" | "absent";
}

// Interface for the Attendance document
export interface IAttendance extends Document {
    vtcStudentId: string;
    semester: SemesterType;
    status: AttendanceStatusType;
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

const AttendanceSchema = new Schema<IAttendance>(
    {
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
            default: "ACTIVE",
            enum: ["ACTIVE", "FINISHED"],
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
                actualDuration: Number,
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

AttendanceSchema.index({ courseCode: 1, vtcStudentId: 1, semester: 1 }, { unique: true });
AttendanceSchema.index({ vtcStudentId: 1, courseCode: 1 });

const Attendance: Model<IAttendance> =
    mongoose.models.Attendance ||
    mongoose.model<IAttendance>("Attendance", AttendanceSchema);

export default Attendance;
