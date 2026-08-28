import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";

const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

const refreshCookieOptions = (maxAge: number) => ({
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: (env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge,
});

/** Reads the token's own `exp` claim so the cookie's maxAge always matches what was
 * actually signed, without duplicating JWT_REFRESH_EXPIRES_IN parsing here. */
export const setRefreshCookie = (res: Response, refreshToken: string): void => {
    const { exp } = jwt.decode(refreshToken) as { exp: number };
    const maxAge = Math.max(exp * 1000 - Date.now(), 0);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions(maxAge));
};

export const clearRefreshCookie = (res: Response): void => {
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
};

export const getRefreshCookie = (req: Request): string | undefined =>
    (req.cookies as Record<string, string | undefined> | undefined)?.[
        REFRESH_COOKIE_NAME
    ];
