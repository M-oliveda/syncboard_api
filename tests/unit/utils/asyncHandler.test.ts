import { describe, test, expect, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { asyncHandler } from "@/utils/asyncHandler.js";

describe("asyncHandler", () => {
    test("calls next with no error on success", async () => {
        const handler = jest.fn(async () => {});
        const next = jest.fn();
        await asyncHandler(handler)({} as Request, {} as Response, next);
        expect(next).not.toHaveBeenCalled();
    });

    test("forwards a rejected promise to next", async () => {
        const error = new Error("boom");
        const handler = jest.fn(async () => {
            throw error;
        });
        const next = jest.fn();
        await asyncHandler(handler)({} as Request, {} as Response, next);
        expect(next).toHaveBeenCalledWith(error);
    });
});
