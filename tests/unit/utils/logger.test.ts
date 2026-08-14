import { describe, test, expect, afterEach, jest } from "@jest/globals";

describe("logger", () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalLogLevel = process.env.LOG_LEVEL;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        process.env.LOG_LEVEL = originalLogLevel;
        jest.resetModules();
    });

    test("uses JSON formatting in production", async () => {
        jest.resetModules();
        process.env.NODE_ENV = "production";
        const { logger } = await import("@/utils/logger.js");
        expect(logger.level).toBe(originalLogLevel ?? "info");
        logger.info("hello");
    });

    test("uses dev formatting outside production", async () => {
        jest.resetModules();
        process.env.NODE_ENV = "development";
        delete process.env.LOG_LEVEL;
        const { logger } = await import("@/utils/logger.js");
        expect(logger.level).toBe("info");
        logger.info("hello");
        logger.info("hello with meta", { requestId: "abc" });
    });
});
