import type { NextFunction, Request, Response } from "express";
import { passport } from "@/config/passport.js";
import { UnauthenticatedError } from "@/utils/errors.js";

/**
 * Wraps passport.authenticate("jwt") with a custom callback so an auth
 * failure flows through the centralized errorHandler as RFC 7807, instead
 * of passport's default plain-text 401 response.
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
    passport.authenticate(
        "jwt",
        { session: false },
        (err: unknown, user: Express.User | false) => {
            if (err) {
                next(err);
                return;
            }

            if (!user) {
                next(new UnauthenticatedError("Missing or invalid access token"));
                return;
            }

            req.user = user;
            next();
        },
    )(req, res, next);
};
