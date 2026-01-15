import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
    discordId: string;
    discordUsername?: string;
    discordAvatar?: string;
    email?: string;
    password?: string;
    authProvider: string[];
    vtcToken?: string;
    vtcStudentId?: string;
    attendanceGracePeriod: number; // Minutes
    lastSync?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        discordId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        discordUsername: {
            type: String,
        },
        discordAvatar: {
            type: String,
        },
        vtcToken: {
            type: String,
        },
        email: {
            type: String,
            unique: true,
            sparse: true,
            index: true,
        },
        password: {
            type: String,
        },
        authProvider: {
            type: [String],
            default: ["discord"],
        },
        vtcStudentId: {
            type: String,
            index: true,
        },
        attendanceGracePeriod: {
            type: Number,
            default: 10,
        },
        lastSync: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Prevent model recompilation in development
const User: Model<IUser> =
    mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
