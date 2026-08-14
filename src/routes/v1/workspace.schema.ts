import { z } from "zod";
import { WORKSPACE_ROLES } from "@/models/workspace.model.js";
import { objectIdString } from "@/utils/objectId.js";

const BaseWorkspaceSchema = z.object({
    name: z.string().trim().min(1).max(200),
});

export const CreateWorkspaceSchema = BaseWorkspaceSchema;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const UpdateWorkspaceSchema = BaseWorkspaceSchema;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

export const AddMemberSchema = z.object({
    userId: objectIdString,
    role: z.enum(WORKSPACE_ROLES).optional(),
});
export type AddMemberInput = z.infer<typeof AddMemberSchema>;

export const UpdateMemberRoleSchema = z.object({
    role: z.enum(WORKSPACE_ROLES),
});
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
