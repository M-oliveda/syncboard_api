import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { mockFn } from "../../helpers/mockFn.js";

const logger = { info: mockFn() };

jest.unstable_mockModule("@/utils/logger.js", () => ({ logger }));

const { sendPasswordResetEmail } = await import("@/services/passwordResetMailer.js");

beforeEach(() => {
    jest.clearAllMocks();
});

describe("sendPasswordResetEmail", () => {
    test("logs the reset URL outside production", async () => {
        await sendPasswordResetEmail(
            "user@example.com",
            "http://localhost:5173/reset-password?token=abc",
            "test",
        );

        expect(logger.info).toHaveBeenCalledWith(
            expect.stringContaining("Password reset requested"),
            {
                email: "user@example.com",
                resetUrl: "http://localhost:5173/reset-password?token=abc",
            },
        );
    });

    test("defaults nodeEnv to env.NODE_ENV when omitted", async () => {
        await sendPasswordResetEmail(
            "user@example.com",
            "http://localhost:5173/reset-password?token=abc",
        );

        expect(logger.info).toHaveBeenCalledTimes(1);
    });

    test("no-ops in production", async () => {
        await sendPasswordResetEmail(
            "user@example.com",
            "http://localhost:5173/reset-password?token=abc",
            "production",
        );

        expect(logger.info).not.toHaveBeenCalled();
    });
});
