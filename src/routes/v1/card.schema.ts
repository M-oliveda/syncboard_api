import { z } from "zod";
import { objectIdString } from "@/utils/objectId.js";
import { requireAtLeastOneField } from "@/utils/zodHelpers.js";

const ChecklistItemSchema = z.object({
    text: z.string().trim().min(1).max(500),
    done: z.boolean().optional(),
});

export const CreateCardSchema = z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().max(5000).optional(),
    order: z.number().finite().optional(),
    assignees: z.array(objectIdString).optional(),
    labels: z.array(z.string().trim().min(1).max(50)).optional(),
    checklist: z.array(ChecklistItemSchema).optional(),
});
export type CreateCardInput = z.infer<typeof CreateCardSchema>;

export const UpdateCardSchema = requireAtLeastOneField(
    z.object({
        title: z.string().trim().min(1).max(300).optional(),
        description: z.string().max(5000).optional(),
        order: z.number().finite().optional(),
        listId: objectIdString.optional(),
        assignees: z.array(objectIdString).optional(),
        labels: z.array(z.string().trim().min(1).max(50)).optional(),
        checklist: z.array(ChecklistItemSchema).optional(),
    }),
);
export type UpdateCardInput = z.infer<typeof UpdateCardSchema>;
