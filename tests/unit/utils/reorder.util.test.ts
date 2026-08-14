import { describe, test, expect } from "@jest/globals";
import { computeOrderBetween } from "@/utils/reorder.js";

describe("computeOrderBetween", () => {
    test("returns the midpoint between two orders", () => {
        expect(computeOrderBetween(1, 2)).toBe(1.5);
    });

    test("returns a value below the first card when moved to the top", () => {
        expect(computeOrderBetween(null, 1)).toBeLessThan(1);
    });

    test("returns a value above the last card when appended to the end", () => {
        expect(computeOrderBetween(3, null)).toBeGreaterThan(3);
    });

    test("returns a default order for the first item in an empty list", () => {
        expect(computeOrderBetween(null, null)).toBe(1);
    });
});
