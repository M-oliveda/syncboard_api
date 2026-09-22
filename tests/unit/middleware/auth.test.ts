import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response } from "express";

type AuthCallback = (err: unknown, user: unknown) => void;

const authenticateBehavior: { err: unknown; user: unknown } = {
    err: null,
    user: false,
};

jest.unstable_mockModule("@/config/passport.js", () => ({
    passport: {
        authenticate: jest.fn(
            (_strategy: string, _opts: unknown, callback: AuthCallback) =>
                (_req: Request, _res: Response, _next: unknown) => {
                    callback(authenticateBehavior.err, authenticateBehavior.user);
                },
        ),
    },
}));

const { requireAuth } = await import("@/middleware/auth.js");
const { UnauthenticatedError } = await import("@/utils/errors.js");

describe("requireAuth", () => {
    beforeEach(() => {
        authenticateBehavior.err = null;
        authenticateBehavior.user = false;
    });

    test("sets req.user and calls next() when authentication succeeds", () => {
        const user = { _id: "user-1" };
        authenticateBehavior.user = user;
        const req = {} as Request;
        const next = jest.fn();

        requireAuth(req, {} as Response, next);

        expect(req.user).toBe(user);
        expect(next).toHaveBeenCalledWith();
    });

    test("calls next with UnauthenticatedError when there is no user", () => {
        const req = {} as Request;
        const next = jest.fn();

        requireAuth(req, {} as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
    });

    test("forwards a strategy error to next", () => {
        const error = new Error("strategy failure");
        authenticateBehavior.err = error;
        const req = {} as Request;
        const next = jest.fn();

        requireAuth(req, {} as Response, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});
