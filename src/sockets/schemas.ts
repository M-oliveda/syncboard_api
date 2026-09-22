import { z } from "zod";
import { objectIdString } from "@/utils/objectId.js";

export const BoardJoinSchema = z.object({
    boardId: objectIdString,
});
export type BoardJoinInput = z.infer<typeof BoardJoinSchema>;

export const CardMovedSchema = z.object({
    cardId: objectIdString,
    sourceListId: objectIdString.optional(),
    targetListId: objectIdString,
    newOrder: z.number().finite(),
});
export type CardMovedInput = z.infer<typeof CardMovedSchema>;
