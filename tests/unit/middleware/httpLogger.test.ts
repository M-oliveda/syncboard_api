import { describe, test, expect, jest } from "@jest/globals";
import type { Request, Response } from "express";

jest.unstable_mockModule("@/utils/logger.js", () => ({
    logger: { http: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const { httpLogFormatter, httpLogger } = await import("@/middleware/httpLogger.js");
const { logger } = await import("@/utils/logger.js");

describe("httpLogFormatter", () => {
    test("logs a structured HTTP request entry carrying the request id", () => {
        const req = { id: "req-123" } as Request;
        const res = {} as Response;
        const tokens: Parameters<typeof httpLogFormatter>[0] = {
            method: () => "GET",
            url: () => "/api/v1/boards",
            status: () => "200",
            "response-time": () => "12.345",
            res: () => "42",
        };

        const result = httpLogFormatter(tokens, req, res);

        expect(result).toBeUndefined();
        expect(logger.http).toHaveBeenCalledWith("HTTP request", {
            requestId: "req-123",
            method: "GET",
            url: "/api/v1/boards",
            status: 200,
            responseTimeMs: 12.345,
            contentLength: "42",
        });
    });
});

describe("httpLogger", () => {
    test("wires the formatter into a Morgan middleware function", () => {
        expect(typeof httpLogger).toBe("function");
    });
});
