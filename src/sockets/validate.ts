import type { ZodType } from "zod";
import { ValidationError } from "@/utils/errors.js";

export const parseSocketPayload = <T>(schema: ZodType<T>, payload: unknown): T => {
    const result = schema.safeParse(payload);

    if (!result.success) {
        const detail = result.error.issues
            .map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`)
            .join("; ");
        throw new ValidationError(detail);
    }

    return result.data;
};
