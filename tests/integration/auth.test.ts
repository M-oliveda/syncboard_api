import { describe, test, expect, jest, afterEach } from "@jest/globals";
import request from "supertest";
import { app } from "@/app.js";
import { logger } from "@/utils/logger.js";

const uniqueEmail = () => `user-${Date.now()}-${Math.random()}@test.dev`;

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
            expect(response.body.data.refreshToken).toEqual(expect.any(String));
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
            const originalRefreshToken = registered.body.data.refreshToken as string;

            const refreshed = await request(app)
                .post("/api/v1/auth/refresh")
                .send({ refreshToken: originalRefreshToken })
                .expect(200);

            expect(refreshed.body.data.refreshToken).not.toBe(originalRefreshToken);

            await request(app)
                .post("/api/v1/auth/refresh")
                .send({ refreshToken: originalRefreshToken })
                .expect(401);

            await request(app)
                .post("/api/v1/auth/refresh")
                .send({ refreshToken: refreshed.body.data.refreshToken })
                .expect(200);
        });

        test("rejects a malformed refresh token", async () => {
            await request(app)
                .post("/api/v1/auth/refresh")
                .send({ refreshToken: "not-a-jwt" })
                .expect(401);
        });
    });

    describe("POST /auth/logout", () => {
        test("revokes the refresh token", async () => {
            const email = uniqueEmail();
            const registered = await request(app)
                .post("/api/v1/auth/register")
                .send({ email, password: "correct-password1" })
                .expect(201);
            const { accessToken, refreshToken } = registered.body.data as {
                accessToken: string;
                refreshToken: string;
            };

            await request(app)
                .post("/api/v1/auth/logout")
                .set("Authorization", `Bearer ${accessToken}`)
                .expect(204);

            await request(app)
                .post("/api/v1/auth/refresh")
                .send({ refreshToken })
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

            const infoSpy = jest.spyOn(logger, "info");

            await request(app)
                .post("/api/v1/auth/forgot-password")
                .send({ email })
                .expect(202);

            const calls = infoSpy.mock.calls as unknown as [
                string,
                { email: string; resetUrl: string },
            ][];
            const call = calls.find((args) => args[1]?.email === email);
            expect(call).toBeDefined();
            const resetUrl = (call as (typeof calls)[number])[1].resetUrl;
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

            infoSpy.mockRestore();
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
