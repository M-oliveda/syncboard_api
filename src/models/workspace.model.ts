import { Schema, model, Types, type InferSchemaType } from "mongoose";

export const WORKSPACE_ROLES = ["Admin", "Member"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const memberSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        role: {
            type: String,
            enum: WORKSPACE_ROLES,
            default: "Member",
        },
    },
    { _id: false },
);

const workspaceSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        members: {
            type: [memberSchema],
            default: [],
        },
    },
    { timestamps: true },
);

export type Workspace = InferSchemaType<typeof workspaceSchema>;
export type WorkspaceMember = { userId: Types.ObjectId; role: WorkspaceRole };

export const WorkspaceModel = model<Workspace>("Workspace", workspaceSchema);
