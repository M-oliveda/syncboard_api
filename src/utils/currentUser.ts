import type { Request } from "express";
import { UnauthenticatedError } from "@/utils/errors.js";

/** requireAuth guarantees req.user is set before a controller runs. */
export const currentUserId = (req: Request): string => {
    if (!req.user) {
        throw new UnauthenticatedError("Missing or invalid access token");
    }

    return req.user._id.toString();
};
