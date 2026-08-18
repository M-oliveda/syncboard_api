import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { createHash } from "node:crypto";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { mockFn } from "../../helpers/mockFn.js";
import { createFakeQuery } from "../../helpers/mockQuery.js";

const UserModel = {
    create: mockFn(),
    findOne: mockFn(),
    findById: mockFn(),
    findByIdAndUpdate: mockFn(),
};
const sendPasswordResetEmail = mockFn();
const sendWelcomeEmail = mockFn();

jest.unstable_mockModule("@/models/user.model.js", () => ({ UserModel }));
jest.unstable_mockModule("@/services/email.service.js", () => ({
    sendPasswordResetEmail,
    sendWelcomeEmail,
}));

const authService = await import("@/services/auth.service.js");
const { env } = await import("@/config/env.js");
const { UnauthenticatedError, ValidationError } = await import("@/utils/errors.js");

const hashToken = (raw: string): string =>
    createHash("sha256").update(raw).digest("hex");

const signRefreshToken = (
    userId: string,
    options: jwt.SignOptions = {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions,
): string =>
    jwt.sign({ sub: userId, jti: "test-jti" }, env.JWT_REFRESH_SECRET, options);

const buildUserDoc = (overrides: Record<string, unknown> = {}) => ({
    _id: new Types.ObjectId(),
    email: "user@example.com",
    passwordHash: bcrypt.hashSync("correct-password", 4),
    refreshTokenHash: undefined as string | undefined,
    passwordResetTokenHash: undefined as string | undefined,
    passwordResetTokenExpiresAt: undefined as Date | undefined,
    save: jest.fn(async function (this: unknown) {
        return this;
    }),
    ...overrides,
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("register", () => {
    test("creates a user, issues tokens, and stores the hashed refresh token", async () => {
        const doc = buildUserDoc();
        UserModel.create.mockResolvedValueOnce(doc);

        const result = await authService.register(
            "user@example.com",
            "correct-password",
        );

        expect(UserModel.create).toHaveBeenCalledWith({
            email: "user@example.com",
            passwordHash: expect.any(String),
        });
        expect(result.user).toBe(doc);
        expect(result.accessToken).toEqual(expect.any(String));
        expect(result.refreshToken).toEqual(expect.any(String));
        expect(doc.refreshTokenHash).toBe(hashToken(result.refreshToken));
        expect(doc.save).toHaveBeenCalledTimes(1);
        expect(sendWelcomeEmail).toHaveBeenCalledWith("user@example.com");
    });
});

describe("login", () => {
    test("issues tokens for a correct password", async () => {
        const doc = buildUserDoc();
        UserModel.findOne.mockReturnValueOnce(createFakeQuery(doc));

        const result = await authService.login("user@example.com", "correct-password");

        expect(result.user).toBe(doc);
        expect(doc.refreshTokenHash).toBe(hashToken(result.refreshToken));
    });

    test("rejects an incorrect password", async () => {
        const doc = buildUserDoc();
        UserModel.findOne.mockReturnValueOnce(createFakeQuery(doc));

        await expect(
            authService.login("user@example.com", "wrong-password"),
        ).rejects.toThrow(UnauthenticatedError);
    });

    test("rejects an unknown email", async () => {
        UserModel.findOne.mockReturnValueOnce(createFakeQuery(null));

        await expect(
            authService.login("nobody@example.com", "correct-password"),
        ).rejects.toThrow(UnauthenticatedError);
    });
});

describe("refresh", () => {
    test("rotates the refresh token on success", async () => {
        const userId = new Types.ObjectId();
        const rawToken = signRefreshToken(userId.toString());
        const doc = buildUserDoc({
            _id: userId,
            refreshTokenHash: hashToken(rawToken),
        });
        UserModel.findById.mockReturnValueOnce(createFakeQuery(doc));

        const result = await authService.refresh(rawToken);

        expect(result.refreshToken).not.toBe(rawToken);
        expect(doc.refreshTokenHash).toBe(hashToken(result.refreshToken));
        expect(doc.refreshTokenHash).not.toBe(hashToken(rawToken));
    });

    test("rejects a token that has already been rotated out", async () => {
        const userId = new Types.ObjectId();
        const rawToken = signRefreshToken(userId.toString());
        const doc = buildUserDoc({
            _id: userId,
            refreshTokenHash: hashToken("some-other-current-token"),
        });
        UserModel.findById.mockReturnValueOnce(createFakeQuery(doc));

        await expect(authService.refresh(rawToken)).rejects.toThrow(
            UnauthenticatedError,
        );
    });

    test("rejects an expired refresh token", async () => {
        const userId = new Types.ObjectId();
        const rawToken = signRefreshToken(userId.toString(), {
            expiresIn: "-10s",
        } as jwt.SignOptions);

        await expect(authService.refresh(rawToken)).rejects.toThrow(
            UnauthenticatedError,
        );
    });

    test("rejects a malformed refresh token", async () => {
        await expect(authService.refresh("not-a-jwt")).rejects.toThrow(
            UnauthenticatedError,
        );
    });

    test("rejects when the user has no stored refresh token", async () => {
        const userId = new Types.ObjectId();
        const rawToken = signRefreshToken(userId.toString());
        const doc = buildUserDoc({ _id: userId, refreshTokenHash: undefined });
        UserModel.findById.mockReturnValueOnce(createFakeQuery(doc));

        await expect(authService.refresh(rawToken)).rejects.toThrow(
            UnauthenticatedError,
        );
    });

    test("rejects when the user no longer exists", async () => {
        const rawToken = signRefreshToken(new Types.ObjectId().toString());
        UserModel.findById.mockReturnValueOnce(createFakeQuery(null));

        await expect(authService.refresh(rawToken)).rejects.toThrow(
            UnauthenticatedError,
        );
    });
});

describe("logout", () => {
    test("unsets the stored refresh token hash", async () => {
        const userId = new Types.ObjectId().toString();
        UserModel.findByIdAndUpdate.mockResolvedValueOnce({});

        await authService.logout(userId);

        expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(userId, {
            $unset: { refreshTokenHash: 1 },
        });
    });
});

describe("forgotPassword", () => {
    test("sets a reset token and emails it when the user exists", async () => {
        const doc = buildUserDoc();
        UserModel.findOne.mockResolvedValueOnce(doc);

        await authService.forgotPassword(doc.email);

        expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
        const [email, resetUrl] = sendPasswordResetEmail.mock.calls[0] as [
            string,
            string,
        ];
        expect(email).toBe(doc.email);

        const token = new URL(resetUrl).searchParams.get("token");
        expect(token).toEqual(expect.any(String));
        expect(doc.passwordResetTokenHash).toBe(hashToken(token as string));
        expect(doc.passwordResetTokenExpiresAt).toBeInstanceOf(Date);
        expect(doc.save).toHaveBeenCalledTimes(1);
    });

    test("silently no-ops for an unknown email", async () => {
        UserModel.findOne.mockResolvedValueOnce(null);

        await expect(
            authService.forgotPassword("nobody@example.com"),
        ).resolves.toBeUndefined();
        expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });
});

describe("resetPassword", () => {
    test("sets a new password and clears reset + refresh token fields", async () => {
        const doc = buildUserDoc({
            passwordResetTokenHash: hashToken("valid-token"),
            passwordResetTokenExpiresAt: new Date(Date.now() + 60000),
            refreshTokenHash: "some-existing-hash",
        });
        UserModel.findOne.mockReturnValueOnce(createFakeQuery(doc));

        await authService.resetPassword("valid-token", "new-password1");

        expect(await bcrypt.compare("new-password1", doc.passwordHash)).toBe(true);
        expect(doc.passwordResetTokenHash).toBeUndefined();
        expect(doc.passwordResetTokenExpiresAt).toBeUndefined();
        expect(doc.refreshTokenHash).toBeUndefined();
        expect(doc.save).toHaveBeenCalledTimes(1);
    });

    test("rejects an invalid or expired reset token", async () => {
        UserModel.findOne.mockReturnValueOnce(createFakeQuery(null));

        await expect(
            authService.resetPassword("bad-token", "new-password1"),
        ).rejects.toThrow(ValidationError);
    });
});
