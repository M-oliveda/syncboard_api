import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import swaggerUi, { type JsonObject } from "swagger-ui-express";
import yaml from "js-yaml";
import { env } from "@/config/env.js";
import { passport } from "@/config/passport.js";
import { requestId } from "@/middleware/requestId.js";
import { apiRateLimit } from "@/middleware/rateLimit.js";
import { errorHandler } from "@/middleware/errorHandler.js";
import { NotFoundError } from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";
import { morganFormat } from "@/utils/morganFormat.js";
import { v1Router } from "@/routes/v1/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const openapiPath = path.join(currentDir, "docs", "v1", "openapi.yaml");
const openapiSpec = yaml.load(fs.readFileSync(openapiPath, "utf8")) as JsonObject;

export const createApp = (): Express => {
    const app = express();

    app.use(requestId);
    app.use(
        morgan(morganFormat(env.NODE_ENV), {
            stream: { write: (message: string) => logger.info(message.trim()) },
        }),
    );
    app.use(helmet());
    app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
    app.use(apiRateLimit);
    app.use(express.json());
    app.use(cookieParser());
    app.use(passport.initialize());

    app.use("/api/v1", v1Router);
    app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

    app.use((req, _res, next) => {
        next(new NotFoundError(`Route ${req.originalUrl} not found`));
    });

    app.use(errorHandler);

    return app;
};

export const app = createApp();
