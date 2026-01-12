import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
    discordId: string;
    discordUsername?: string;
    discordAvatar?: string;
    vtcToken?: string;
    vtcStudentId?: string;
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
        vtcStudentId: {
            type: String,
            index: true,
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
