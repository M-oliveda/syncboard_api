import { describe, test, expect } from "@jest/globals";
import { apiRateLimit } from "@/middleware/rateLimit.js";

describe("apiRateLimit", () => {
    test("is an Express middleware function", () => {
        expect(typeof apiRateLimit).toBe("function");
    });
});
