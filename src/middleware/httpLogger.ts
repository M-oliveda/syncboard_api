import morgan from "morgan";
import type { Request, Response } from "express";
import { logger } from "@/utils/logger.js";

/** Logs each request as a structured object (carrying requestId) instead of a
 * preformatted string, so Winston's own dev/prod format renders it consistently
 * with every other log line. */
export const httpLogFormatter: morgan.FormatFn<Request, Response> = (
    tokens,
    req,
    res,
) => {
    logger.http("HTTP request", {
        requestId: req.id,
        method: tokens.method(req, res),
        url: tokens.url(req, res),
        status: Number(tokens.status(req, res)),
        responseTimeMs: Number(tokens["response-time"](req, res)),
        contentLength: tokens.res(req, res, "content-length"),
    });

    return undefined;
};

export const httpLogger = morgan<Request, Response>(httpLogFormatter);
