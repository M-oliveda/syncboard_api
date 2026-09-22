import { describe, test, expect, jest } from "@jest/globals";
import { mockFn } from "../../helpers/mockFn.js";

type Done = (err: unknown, user?: unknown) => void;
type VerifyCallback = (payload: { sub: string }, done: Done) => void;

let capturedVerify!: VerifyCallback;

jest.unstable_mockModule("passport-jwt", () => ({
    Strategy: jest.fn(function (this: unknown, _opts: unknown, verify: VerifyCallback) {
        capturedVerify = verify;
    }),
    ExtractJwt: { fromAuthHeaderAsBearerToken: jest.fn(() => jest.fn()) },
}));

const findByIdMock = mockFn();
jest.unstable_mockModule("@/models/user.model.js", () => ({
    UserModel: { findById: findByIdMock },
}));

const passportUseMock = jest.fn();
jest.unstable_mockModule("passport", () => ({
    default: { use: passportUseMock },
}));

await import("@/config/passport.js");

describe("passport-jwt strategy", () => {
    test("registers a JwtStrategy", () => {
        expect(passportUseMock).toHaveBeenCalledTimes(1);
    });

    test("resolves the user when found", async () => {
        const user = { _id: "user-1" };
        findByIdMock.mockResolvedValueOnce(user);
        const done = jest.fn();

        await capturedVerify({ sub: "user-1" }, done);

        expect(done).toHaveBeenCalledWith(null, user);
    });

    test("resolves false when the user is not found", async () => {
        findByIdMock.mockResolvedValueOnce(null);
        const done = jest.fn();

        await capturedVerify({ sub: "missing" }, done);

        expect(done).toHaveBeenCalledWith(null, false);
    });

    test("forwards a lookup error", async () => {
        const error = new Error("db down");
        findByIdMock.mockRejectedValueOnce(error);
        const done = jest.fn();

        await capturedVerify({ sub: "user-1" }, done);

        expect(done).toHaveBeenCalledWith(error, false);
    });
});
