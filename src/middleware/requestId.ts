import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
    req.id = randomUUID();
    res.setHeader("X-Request-Id", req.id);
    next();
};
