import { describe, test, expect } from "@jest/globals";
import { collectionResponse, successResponse } from "@/utils/response.js";

describe("successResponse", () => {
    test("wraps data without a message", () => {
        expect(successResponse({ id: 1 })).toEqual({ success: true, data: { id: 1 } });
    });

    test("includes a message when provided", () => {
        expect(successResponse({ id: 1 }, "done")).toEqual({
            success: true,
            data: { id: 1 },
            message: "done",
        });
    });
});

describe("collectionResponse", () => {
    test("computes pagination metadata", () => {
        expect(collectionResponse([1, 2], 1, 20, 45)).toEqual({
            success: true,
            data: [1, 2],
            pagination: { page: 1, limit: 20, total: 45, totalPages: 3 },
        });
    });
});
