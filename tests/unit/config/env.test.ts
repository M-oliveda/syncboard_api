import { describe, test, expect, jest, afterEach } from "@jest/globals";

describe("env", () => {
    const original = { ...process.env };

    afterEach(() => {
        process.env = { ...original };
        jest.resetModules();
    });

    test("parses valid environment variables with defaults applied", async () => {
        process.env.MONGO_URI = "mongodb://localhost:27017/syncboard";
        process.env.JWT_SECRET = "test-secret";
        delete process.env.PORT;

        const { env } = await import("@/config/env.js");
        expect(env.MONGO_URI).toBe("mongodb://localhost:27017/syncboard");
        expect(env.PORT).toBe(4000);
    });

    test("throws a descriptive error when a required variable is missing", async () => {
        delete process.env.MONGO_URI;
        process.env.JWT_SECRET = "test-secret";

        await expect(import("@/config/env.js")).rejects.toThrow(
            /Invalid environment configuration/,
        );
    });
});
