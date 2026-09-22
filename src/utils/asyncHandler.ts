import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Forwards a rejected promise from an async route handler to errorHandler. */
export const asyncHandler = (handler: RequestHandler): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
};
