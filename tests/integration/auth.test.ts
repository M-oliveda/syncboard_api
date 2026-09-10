import { describe, test, expect, jest, afterEach, beforeEach } from "@jest/globals";
import request from "supertest";
import { mockFn } from "../helpers/mockFn.js";

const send = mockFn();
send.mockResolvedValue({ data: { id: "email-1" }, error: null });

class MockResend {
    emails = { send };
}

jest.unstable_mockModule("resend", () => ({ Resend: MockResend }));

const { app } = await import("@/app.js");

const uniqueEmail = () => `user-${Date.now()}-${Math.random()}@test.dev`;

const extractUrl = (html: string): string => {
    const match = html.match(/href="([^"]+)"/);
    return (match as RegExpMatchArray)[1];
};

/** Pulls the `refreshToken=...` cookie off a response so it can be replayed on a
 * follow-up request via `.set("Cookie", ...)` — supertest doesn't carry cookies
 * between independent `request(app)` calls automatically. */
const extractRefreshCookie = (response: request.Response): string => {
    const setCookie = response.headers["set-cookie"] as unknown as string[];
    const cookie = setCookie.find((entry) => entry.startsWith("refreshToken="));
    return (cookie as string).split(";")[0];
};

beforeEach(() => {
    send.mockClear();
    send.mockResolvedValue({ data: { id: "email-1" }, error: null });
});

describe("Auth", () => {
    describe("POST /auth/register", () => {
        test("creates a user and issues tokens, without leaking the password hash", async () => {
            const email = uniqueEmail();

            const response = await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);

            expect(response.body.data.user.email).toBe(email);
            expect(response.body.data.user.passwordHash).toBeUndefined();
            expect(response.body.data.accessToken).toEqual(expect.any(String));
            expect(response.body.data.refreshToken).toBeUndefined();
            expect(extractRefreshCookie(response)).toMatch(/^refreshToken=.+/);
            expect(send).toHaveBeenCalledTimes(1);
            const [payload] = send.mock.calls[0] as [{ to: string }];
            expect(payload.to).toBe(email);
        });

        test("rejects a duplicate email", async () => {
            const email = uniqueEmail();
            await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);

            const response = await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "another-password1" })
                .expect(409);

            expect(response.body.type).toBe("https://syncboard.dev/errors/conflict");
        });

        test("rejects a weak password", async () => {
            const response = await request(app)
                .post("/api/v1/auth/register")
                .send({ email: uniqueEmail(), password: "short" })
                .expect(400);

            expect(response.body.type).toBe(
                "https://syncboard.dev/errors/validation-error",
            );
        });
    });

    describe("POST /auth/login", () => {
        test("issues tokens for correct credentials", async () => {
            const email = uniqueEmail();
            await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);

            const response = await request(app)
                .post("/api/v1/auth/login")
                .send({ email, password: "correct-password1" })
                .expect(200);

            expect(response.body.data.accessToken).toEqual(expect.any(String));
        });

        test("rejects an incorrect password", async () => {
            const email = uniqueEmail();
            await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email, password: "wrong-password1" })
                .expect(401);
        });

        test("rejects an unknown email", async () => {
            await request(app)
                .post("/api/v1/auth/login")
                .send({ email: uniqueEmail(), password: "correct-password1" })
                .expect(401);
        });
    });

    describe("POST /auth/refresh", () => {
        test("rotates the refresh token and invalidates the old one", async () => {
            const email = uniqueEmail();
            const registered = await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);
            const originalCookie = extractRefreshCookie(registered);

            const refreshed = await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", originalCookie)
                .expect(200);
            const rotatedCookie = extractRefreshCookie(refreshed);

            expect(refreshed.body.data.refreshToken).toBeUndefined();
            expect(refreshed.body.data.accessToken).toEqual(expect.any(String));
            expect(rotatedCookie).not.toBe(originalCookie);

            await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", originalCookie)
                .expect(401);

            await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", rotatedCookie)
                .expect(200);
        });

        test("rejects a request with no refresh token cookie", async () => {
            await request(app).post("/api/v1/auth/refresh").expect(401);
        });

        test("rejects a malformed refresh token cookie", async () => {
            await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", "refreshToken=not-a-jwt")
                .expect(401);
        });
    });

    describe("POST /auth/logout", () => {
        test("revokes the refresh token and clears the cookie", async () => {
            const email = uniqueEmail();
            const registered = await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);
            const { accessToken } = registered.body.data as { accessToken: string };
            const refreshCookie = extractRefreshCookie(registered);

            const loggedOut = await request(app)
                .post("/api/v1/auth/logout")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(204);

            expect(extractRefreshCookie(loggedOut)).toMatch(
                /^refreshToken=;|^refreshToken=$/,
            );

            await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", refreshCookie)
                .expect(401);
        });

        test("rejects requests without a bearer token", async () => {
            await request(app).post("/api/v1/auth/logout").expect(401);
        });
    });

    describe("POST /auth/forgot-password + /auth/reset-password", () => {
        test("completes the full reset flow", async () => {
            const email = uniqueEmail();
            await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);

            send.mockClear();

            await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email })
                .expect(202);

            expect(send).toHaveBeenCalledTimes(1);
            const [payload] = send.mock.calls[0] as [{ to: string; html: string }];
            expect(payload.to).toBe(email);

            const resetUrl = extractUrl(payload.html);
            const token = new URL(resetUrl).searchParams.get("token") as string;

            await request(app)
                .post("/api/v1/auth/reset-password")
                .send({ token, newPassword: "brand-new-password1" })
                .expect(204);

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email, password: "correct-password1" })
                .expect(401);

            await request(app)
                .post("/api/v1/auth/login")
                .send({ email, password: "brand-new-password1" })
                .expect(200);
        });

        test("returns 202 for forgot-password even when the email is unknown", async () => {
            await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email: uniqueEmail() })
                .expect(202);
        });

        test("rejects an invalid reset token", async () => {
            await request(app)
                .post("/api/v1/auth/reset-password")
                .send({ token: "bad-token", newPassword: "brand-new-password1" })
                .expect(400);
        });
    });

    describe("rate limiting", () => {
        const originalMax = process.env.AUTH_RATE_LIMIT_MAX_REQUESTS;

        afterEach(() => {
            if (originalMax === undefined) {
                delete process.env.AUTH_RATE_LIMIT_MAX_REQUESTS;
            } else {
                process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = originalMax;
            }
            jest.resetModules();
        });

        test("returns 429 after exceeding the auth rate limit", async () => {
            jest.resetModules();
            process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = "2";
            const { app: limitedApp } = await import("@/app.js");

            // Empty bodies fail validation before ever touching the DB — the
            // rate limiter still counts them, since it runs first.
            await request(limitedApp).post("/api/v1/auth/login").send({}).expect(400);
            await request(limitedApp).post("/api/v1/auth/login").send({}).expect(400);
            await request(limitedApp).post("/api/v1/auth/login").send({}).expect(429);
        });
    });
});
