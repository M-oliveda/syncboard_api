import { describe, test, expect, jest } from "@jest/globals";
import mongoose from "mongoose";
import type { Request, Response } from "express";

jest.unstable_mockModule("@/utils/logger.js", () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const { errorHandler } = await import("@/middleware/errorHandler.js");
const { logger } = await import("@/utils/logger.js");
const { NotFoundError } = await import("@/utils/errors.js");

const buildRes = () => {
    const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
    res.status = jest.fn((code: number) => {
        res.statusCode = code;
        return res as Response;
    }) as unknown as Response["status"];
    res.type = jest.fn(() => res as Response) as unknown as Response["type"];
    res.send = jest.fn((body: unknown) => {
        res.body = body;
        return res as Response;
    }) as unknown as Response["send"];
    return res as Response & { statusCode?: number; body?: unknown };
};

const req = { originalUrl: "/api/v1/boards/123" } as Request;

describe("errorHandler", () => {
    test("formats an AppError as RFC 7807 without logging", () => {
        const res = buildRes();
        const next = jest.fn();

        errorHandler(new NotFoundError("Board 123 not found"), req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.type).toHaveBeenCalledWith("application/problem+json");
        expect(res.body).toMatchObject({
            status: 404,
            detail: "Board 123 not found",
            instance: "/api/v1/boards/123",
        });
        expect(logger.error).not.toHaveBeenCalled();
    });

    test("maps a Mongoose CastError to a 400 ValidationError", () => {
        const res = buildRes();
        const castError = new mongoose.Error.CastError("ObjectId", "bad-id", "boardId");

        errorHandler(castError, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("maps a Mongoose ValidationError to a 400", () => {
        const res = buildRes();
        const validationError = new mongoose.Error.ValidationError();

        errorHandler(validationError, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("maps a duplicate key error to a 409 Conflict", () => {
        const res = buildRes();

        errorHandler({ code: 11000 }, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(409);
    });

    test("falls back to a 500 and logs the original error for anything else", () => {
        const res = buildRes();
        const error = new Error("boom");

        errorHandler(error, req, res, jest.fn());

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.body).toMatchObject({ detail: "An unexpected error occurred" });
        expect(logger.error).toHaveBeenCalledWith(
            "Unhandled error",
            expect.objectContaining({ error }),
        );
    });
});
