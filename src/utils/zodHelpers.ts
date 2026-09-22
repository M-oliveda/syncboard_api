import { z } from "zod";

/** Rejects an empty PATCH body — at least one field must be provided. */
export const requireAtLeastOneField = <T extends z.ZodRawShape>(
    schema: z.ZodObject<T>,
) =>
    schema.refine((data) => Object.keys(data).length > 0, {
        message: "At least one field must be provided",
    });
