import { Schema, model, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false,
        },
        refreshTokenHash: {
            type: String,
            select: false,
        },
        passwordResetTokenHash: {
            type: String,
            select: false,
        },
        passwordResetTokenExpiresAt: {
            type: Date,
            select: false,
        },
    },
    {
        timestamps: true,
        toJSON: {
            transform: (_doc, ret: Record<string, unknown>) => {
                delete ret.passwordHash;
                delete ret.refreshTokenHash;
                delete ret.passwordResetTokenHash;
                delete ret.passwordResetTokenExpiresAt;
                return ret;
            },
        },
    },
);

export type User = InferSchemaType<typeof userSchema>;

export const UserModel = model<User>("User", userSchema);
