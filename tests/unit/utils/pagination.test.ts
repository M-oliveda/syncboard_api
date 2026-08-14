import { describe, test, expect } from "@jest/globals";
import { parsePagination } from "@/utils/pagination.js";

describe("parsePagination", () => {
    test("applies defaults when the query is empty", () => {
        expect(parsePagination({})).toEqual({
            page: 1,
            limit: 20,
            skip: 0,
            sort: { createdAt: 1 },
        });
    });

    test("uses a custom default sort field", () => {
        expect(parsePagination({}, "order")).toEqual({
            page: 1,
            limit: 20,
            skip: 0,
            sort: { order: 1 },
        });
    });

    test("parses page/limit and computes skip", () => {
        expect(parsePagination({ page: "3", limit: "10" })).toEqual({
            page: 3,
            limit: 10,
            skip: 20,
            sort: { createdAt: 1 },
        });
    });

    test("clamps limit to the maximum of 100", () => {
        expect(parsePagination({ limit: "500" }).limit).toBe(100);
    });

    test("falls back to defaults for invalid page/limit values", () => {
        expect(parsePagination({ page: "abc", limit: "-5" })).toEqual({
            page: 1,
            limit: 20,
            skip: 0,
            sort: { createdAt: 1 },
        });
    });

    test("parses a descending sort field", () => {
        expect(parsePagination({ sort: "-title" }).sort).toEqual({ title: -1 });
    });

    test("ignores a non-string sort value", () => {
        expect(parsePagination({ sort: ["title"] }).sort).toEqual({ createdAt: 1 });
    });
});
