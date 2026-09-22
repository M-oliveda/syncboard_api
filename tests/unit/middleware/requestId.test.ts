import { describe, test, expect, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { requestId } from "@/middleware/requestId.js";

describe("requestId", () => {
    test("sets req.id and the X-Request-Id header, then calls next", () => {
        const req = {} as Request;
        const setHeader = jest.fn();
        const res = { setHeader } as unknown as Response;
        const next = jest.fn();

        requestId(req, res, next);

        expect(req.id).toEqual(expect.any(String));
        expect(setHeader).toHaveBeenCalledWith("X-Request-Id", req.id);
        expect(next).toHaveBeenCalledTimes(1);
    });
});
