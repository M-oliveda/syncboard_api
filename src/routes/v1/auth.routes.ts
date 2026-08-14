import { Router } from "express";
import { requireAuth } from "@/middleware/auth.js";
import { validate } from "@/middleware/validate.js";
import { authRateLimit } from "@/middleware/rateLimit.js";
import { asyncHandler } from "@/utils/asyncHandler.js";
import { currentUserId } from "@/utils/currentUser.js";
import { successResponse } from "@/utils/response.js";
import * as authService from "@/services/auth.service.js";
import {
    ForgotPasswordSchema,
    LoginSchema,
    RefreshSchema,
    RegisterSchema,
    ResetPasswordSchema,
    type ForgotPasswordInput,
    type LoginInput,
    type RefreshInput,
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
        const result = await authService.register(email, password);
        res.status(201).json(successResponse(result));
    }),
);

authRouter.post(
    "/login",
    validate(LoginSchema),
    asyncHandler(async (req, res) => {
        const { email, password } = req.body as LoginInput;
        const result = await authService.login(email, password);
        res.json(successResponse(result));
    }),
);

authRouter.post(
    "/refresh",
    validate(RefreshSchema),
    asyncHandler(async (req, res) => {
        const { refreshToken } = req.body as RefreshInput;
        const result = await authService.refresh(refreshToken);
        res.json(successResponse(result));
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
        res.status(204).send();
    }),
);
