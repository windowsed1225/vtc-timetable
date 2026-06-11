import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUser extends Document {
	discordId: string;
	discordUsername?: string;
	discordAvatar?: string;
	discordAccessToken?: string;
	email?: string;
	password?: string;
	authProvider: string[];
	vtcToken?: string;
	vtcStudentId?: string;
	attendanceGracePeriod: number; // Minutes
	lastSync?: Date;
	locale: "en" | "zh-HK";
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
		discordAccessToken: {
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
		locale: {
			type: String,
			enum: ["en", "zh-HK"],
			default: "en",
		},
	},
	{
		timestamps: true,
	},
);

// Prevent model recompilation in development
const User: Model<IUser> = mongoose.models.Users || mongoose.model<IUser>("Users", UserSchema);

export default User;
