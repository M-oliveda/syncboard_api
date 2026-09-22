import { Router } from "express";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { authRateLimit } from "@/middleware/rateLimit.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { currentUserId } from "@/utils/currentUser.js";
import { successResponse } from "@/utils/response.js";
import { UnauthenticatedError } from "@/utils/errors.js";
import {
    clearRefreshCookie,
    getRefreshCookie,
    setRefreshCookie,
} from "@/utils/authCookie.js";
import * as authService from "@/services/auth.service.js";
import {
    ForgotPasswordSchema,
    LoginSchema,
    RegisterSchema,
    ResetPasswordSchema,
    type ForgotPasswordInput,
    type LoginInput,
    type RegisterInput,
    type ResetPasswordInput,
} from "@/routes/v1/auth.schema.js";

export const authRouter = Router();

authRouter.use(authRateLimit);

authRouter.post(
    "/register",
    validate(RegisterSchema),
    asyncHandler(async (req, res) => {
        const { email, password } = req.body as RegisterInput;
        const { user, accessToken, refreshToken } = await authService.register(
            email,
            password,
        );
        setRefreshCookie(res, refreshToken);
        res.status(201).json(successResponse({ user, accessToken }));
    }),
);

authRouter.post(
    "/login",
    validate(LoginSchema),
    asyncHandler(async (req, res) => {
        const { email, password } = req.body as LoginInput;
        const { user, accessToken, refreshToken } = await authService.login(
            email,
            password,
        );
        setRefreshCookie(res, refreshToken);
        res.json(successResponse({ user, accessToken }));
    }),
);

authRouter.post(
    "/refresh",
    asyncHandler(async (req, res) => {
        const refreshToken = getRefreshCookie(req);

        if (!refreshToken) {
            throw new UnauthenticatedError("No refresh token cookie present");
        }

        const tokens = await authService.refresh(refreshToken);
        setRefreshCookie(res, tokens.refreshToken);
        res.json(successResponse({ accessToken: tokens.accessToken }));
    }),
);

authRouter.post(
    "/forgot-password",
    validate(ForgotPasswordSchema),
    asyncHandler(async (req, res) => {
        const { email } = req.body as ForgotPasswordInput;
        await authService.forgotPassword(email);
        res.status(202).json(
            successResponse(null, "If that email exists, a reset link has been sent"),
        );
    }),
);

authRouter.post(
    "/reset-password",
    validate(ResetPasswordSchema),
    asyncHandler(async (req, res) => {
        const { token, newPassword } = req.body as ResetPasswordInput;
        await authService.resetPassword(token, newPassword);
        res.status(204).send();
    }),
);

authRouter.post(
    "/logout",
    requireAuth,
    asyncHandler(async (req, res) => {
        await authService.logout(currentUserId(req));
        clearRefreshCookie(res);
        res.status(204).send();
    }),
);
