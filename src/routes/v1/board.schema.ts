import { z } from "zod";

const BaseBoardSchema = z.object({
    title: z.string().trim().min(1).max(200),
});

export const CreateBoardSchema = BaseBoardSchema;
export type CreateBoardInput = z.infer<typeof CreateBoardSchema>;

export const UpdateBoardSchema = BaseBoardSchema;
export type UpdateBoardInput = z.infer<typeof UpdateBoardSchema>;
