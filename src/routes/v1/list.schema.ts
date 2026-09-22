import { z } from "zod";
import { requireAtLeastOneField } from "@/utils/zodHelpers.js";

export const CreateListSchema = z.object({
    title: z.string().trim().min(1).max(200),
    order: z.number().finite().optional(),
});
export type CreateListInput = z.infer<typeof CreateListSchema>;

export const UpdateListSchema = requireAtLeastOneField(
    z.object({
        title: z.string().trim().min(1).max(200).optional(),
        order: z.number().finite().optional(),
    }),
);
export type UpdateListInput = z.infer<typeof UpdateListSchema>;
