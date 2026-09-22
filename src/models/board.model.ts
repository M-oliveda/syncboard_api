import { Schema, model, type InferSchemaType } from "mongoose";

const boardSchema = new Schema(
    {
        workspaceId: {
            type: Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: true },
);

export type Board = InferSchemaType<typeof boardSchema>;

export const BoardModel = model<Board>("Board", boardSchema);
