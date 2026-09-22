import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { mockFn } from "../../helpers/mockFn.js";

const send = mockFn();

class MockResend {
    emails = { send };
}

jest.unstable_mockModule("resend", () => ({ Resend: MockResend }));

const { sendPasswordResetEmail, sendWelcomeEmail } =
    await import("@/services/email.service.js");
const { env } = await import("@/config/env.js");

beforeEach(() => {
    jest.clearAllMocks();
});

describe("sendPasswordResetEmail", () => {
    test("renders the reset template and sends it via Resend", async () => {
        send.mockResolvedValueOnce({ data: { id: "email-1" }, error: null });

        await sendPasswordResetEmail(
            "user@example.com",
            "http://localhost:5173/reset-password?token=abc",
        );

        expect(send).toHaveBeenCalledTimes(1);
        const [payload] = send.mock.calls[0] as [
            { from: string; to: string; subject: string; html: string },
        ];
        expect(payload.from).toBe(env.EMAIL_FROM);
        expect(payload.to).toBe("user@example.com");
        expect(payload.subject).toEqual(expect.any(String));
        expect(payload.html).toContain(
            "http://localhost:5173/reset-password?token=abc",
        );
    });

    test("propagates a Resend delivery failure", async () => {
        send.mockRejectedValueOnce(new Error("Resend API error"));

        await expect(
            sendPasswordResetEmail("user@example.com", "http://localhost:5173/reset"),
        ).rejects.toThrow("Resend API error");
    });

    test("throws when Resend returns an error payload", async () => {
        send.mockResolvedValueOnce({
            data: null,
            error: { message: "bounce" },
        });

        await expect(
            sendPasswordResetEmail("user@example.com", "http://localhost:5173/reset"),
        ).rejects.toThrow("Failed to send password reset email: bounce");
    });
});

describe("sendWelcomeEmail", () => {
    test("renders the welcome template and sends it via Resend", async () => {
        send.mockResolvedValueOnce({ data: { id: "email-2" }, error: null });

        await sendWelcomeEmail("user@example.com");

        expect(send).toHaveBeenCalledTimes(1);
        const [payload] = send.mock.calls[0] as [
            { from: string; to: string; subject: string; html: string },
        ];
        expect(payload.from).toBe(env.EMAIL_FROM);
        expect(payload.to).toBe("user@example.com");
        expect(payload.html).toContain("user@example.com");
    });

    test("propagates a Resend delivery failure", async () => {
        send.mockRejectedValueOnce(new Error("Resend API error"));

        await expect(sendWelcomeEmail("user@example.com")).rejects.toThrow(
            "Resend API error",
        );
    });

    test("throws when Resend returns an error payload", async () => {
        send.mockResolvedValueOnce({
            data: null,
            error: { message: "bounce" },
        });

        await expect(sendWelcomeEmail("user@example.com")).rejects.toThrow(
            "Failed to send welcome email: bounce",
        );
    });
});
