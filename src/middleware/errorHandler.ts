import mongoose from "mongoose";
import type { NextFunction, Request, Response } from "express";
import {
    AppError,
    ConflictError,
    InternalServerError,
    ValidationError,
    toProblemPayload,
    type ProblemPayload,
} from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";

interface ProblemDetails extends ProblemPayload {
    instance: string;
}

const isDuplicateKeyError = (error: unknown): boolean => {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code: unknown }).code === 11000
    );
};

const toAppError = (error: unknown): AppError => {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof mongoose.Error.CastError) {
        return new ValidationError(`Invalid ${error.path}: ${String(error.value)}`);
    }

    if (error instanceof mongoose.Error.ValidationError) {
        return new ValidationError(error.message);
    }

    if (isDuplicateKeyError(error)) {
        return new ConflictError("A resource with that value already exists");
    }

    return new InternalServerError("An unexpected error occurred");
};

export const errorHandler = (
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    const appError = toAppError(error);

    if (appError.status >= 500) {
        logger.error("Unhandled error", { requestId: req.id, error });
    }

    const problem: ProblemDetails = {
        ...toProblemPayload(appError),
        instance: req.originalUrl,
    };

    res.status(appError.status).type("application/problem+json").send(problem);
};
