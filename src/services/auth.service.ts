import { randomUUID, randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";
import { UserModel } from "@/models/user.model.js";
import { UnauthenticatedError, ValidationError } from "@/utils/errors.js";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/services/email.service.js";
import { logger } from "@/utils/logger.js";

const PASSWORD_HASH_COST = 12;

const hashToken = (raw: string): string =>
    createHash("sha256").update(raw).digest("hex");

const issueTokenPair = (
    userId: string,
): { accessToken: string; refreshToken: string } => {
    const accessToken = jwt.sign({ sub: userId }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshToken = jwt.sign(
        { sub: userId, jti: randomUUID() },
        env.JWT_REFRESH_SECRET,
        { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions,
    );

    return { accessToken, refreshToken };
};

const verifyRefreshToken = (token: string): { sub: string } => {
    try {
        return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string };
    } catch {
        throw new UnauthenticatedError("Invalid or expired refresh token");
    }
};

export const register = async (email: string, password: string) => {
    const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_COST);
    const user = await UserModel.create({ email, passwordHash });

    const { accessToken, refreshToken } = issueTokenPair(user._id.toString());
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    try {
        await sendWelcomeEmail(user.email);
    } catch (error) {
        logger.error("Failed to send welcome email", {
            error: error instanceof Error ? error.message : error,
        });
    }

    return { user, accessToken, refreshToken };
};

export const login = async (email: string, password: string) => {
    const user = await UserModel.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthenticatedError("Invalid email or password");
    }

    const { accessToken, refreshToken } = issueTokenPair(user._id.toString());
    user.refreshTokenHash = hashToken(refreshToken);
    await user.save();

    return { user, accessToken, refreshToken };
};

export const refresh = async (refreshToken: string) => {
    const { sub } = verifyRefreshToken(refreshToken);
    const user = await UserModel.findById(sub).select("+refreshTokenHash");

    if (
        !user ||
        !user.refreshTokenHash ||
        hashToken(refreshToken) !== user.refreshTokenHash
    ) {
        throw new UnauthenticatedError("Refresh token has been rotated or revoked");
    }

    const tokens = issueTokenPair(user._id.toString());
    user.refreshTokenHash = hashToken(tokens.refreshToken);
    await user.save();

    return tokens;
};

export const logout = async (userId: string): Promise<void> => {
    await UserModel.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
};

export const forgotPassword = async (email: string): Promise<void> => {
    const user = await UserModel.findOne({ email });

    if (!user) {
        return;
    }

    const rawToken = randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetTokenExpiresAt = new Date(
        Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRES_IN_MS,
    );
    await user.save();

    const resetUrl = `${env.CORS_ORIGIN}/reset-password?token=${rawToken}`;

    try {
        await sendPasswordResetEmail(user.email, resetUrl);
    } catch (error) {
        logger.error("Failed to send password reset email", {
            error: error instanceof Error ? error.message : error,
        });
    }
};

export const resetPassword = async (
    token: string,
    newPassword: string,
): Promise<void> => {
    const user = await UserModel.findOne({
        passwordResetTokenHash: hashToken(token),
        passwordResetTokenExpiresAt: { $gt: new Date() },
    }).select("+passwordResetTokenHash +passwordResetTokenExpiresAt");

    if (!user) {
        throw new ValidationError("Invalid or expired reset token");
    }

    user.passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);
    user.passwordResetTokenHash = undefined;
    user.passwordResetTokenExpiresAt = undefined;
    user.refreshTokenHash = undefined;
    await user.save();
};
