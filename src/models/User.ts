import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUser extends Document {
	discordId?: string;
	discordUsername?: string;
	discordAvatar?: string;
	discordAccessToken?: string;
	email?: string;
	password?: string;
	authProvider: string[];
	vtcToken?: string;
	vtcStudentId?: string;
	calendarShareToken?: string;
	attendanceGracePeriod: number; // Minutes
	/** Optional passing-rate override in percent. Unset means the shared default of 80. */
	gracePeriodThreshold?: number;
	lastSync?: Date;
	locale: "en" | "zh-HK";
	createdAt: Date;
	updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
	{
		discordId: {
			type: String,
			required: false,
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
		calendarShareToken: {
			type: String,
			unique: true,
			sparse: true,
			index: true,
		},
		attendanceGracePeriod: {
			type: Number,
			default: 10,
		},
		gracePeriodThreshold: {
			type: Number,
			required: false,
			min: 1,
			max: 100,
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

// Email/password users have no Discord id. A plain unique index treats missing/null
// as one value, so the second signup hits E11000. Index only actual snowflakes.
UserSchema.index(
	{ discordId: 1 },
	{ unique: true, name: "discordId_1", partialFilterExpression: { discordId: { $type: "string" } } },
);

// Prevent model recompilation in development
const User: Model<IUser> = mongoose.models.Users || mongoose.model<IUser>("Users", UserSchema);

export default User;
