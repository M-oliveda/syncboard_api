import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";

const mockEnv = { NODE_ENV: "test" as string };
jest.unstable_mockModule("@/config/env.js", () => ({ env: mockEnv }));

const { setRefreshCookie, clearRefreshCookie, getRefreshCookie } =
    await import("@/utils/authCookie.js");

const buildResponse = () =>
    ({ cookie: jest.fn(), clearCookie: jest.fn() }) as unknown as Response & {
        cookie: jest.Mock;
        clearCookie: jest.Mock;
    };

beforeEach(() => {
    mockEnv.NODE_ENV = "test";
});

describe("setRefreshCookie", () => {
    test("sets a lax, non-secure cookie outside production", () => {
        mockEnv.NODE_ENV = "development";
        const res = buildResponse();
        const token = jwt.sign({ sub: "user-1" }, "secret", { expiresIn: "7d" });

        setRefreshCookie(res, token);

        expect(res.cookie).toHaveBeenCalledWith(
            "refreshToken",
            token,
            expect.objectContaining({
                httpOnly: true,
                secure: false,
                sameSite: "lax",
                path: "/api/v1/auth",
                maxAge: expect.any(Number),
            }),
        );
    });

    test("sets a secure, sameSite=none cookie in production", () => {
        mockEnv.NODE_ENV = "production";
        const res = buildResponse();
        const token = jwt.sign({ sub: "user-1" }, "secret", { expiresIn: "7d" });

        setRefreshCookie(res, token);

        expect(res.cookie).toHaveBeenCalledWith(
            "refreshToken",
            token,
            expect.objectContaining({ secure: true, sameSite: "none" }),
        );
    });
});

describe("clearRefreshCookie", () => {
    test("clears the cookie at the scoped path", () => {
        const res = buildResponse();

        clearRefreshCookie(res);

        expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
            path: "/api/v1/auth",
        });
    });
});

describe("getRefreshCookie", () => {
    test("returns the cookie value when present", () => {
        const req = { cookies: { refreshToken: "abc" } } as unknown as Request;
        expect(getRefreshCookie(req)).toBe("abc");
    });

    test("returns undefined when the cookie is missing", () => {
        const req = { cookies: {} } as unknown as Request;
        expect(getRefreshCookie(req)).toBeUndefined();
    });

    test("returns undefined when req.cookies itself is missing", () => {
        const req = {} as unknown as Request;
        expect(getRefreshCookie(req)).toBeUndefined();
    });
});
