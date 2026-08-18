import "dotenv/config";
import http from "node:http";
import { env } from "@/config/env.js";
import { connectDb } from "@/config/db.js";
import { app } from "@/app.js";
import { createSocketServer } from "@/sockets/index.js";
import { logger } from "@/utils/logger.js";

const bootstrap = async (): Promise<void> => {
    await connectDb();

    const httpServer = http.createServer(app);
    createSocketServer(httpServer);

    httpServer.listen(env.PORT, () => {
        logger.info(`SyncBoard API listening on port ${env.PORT}`);
    });
};

bootstrap().catch((error: unknown) => {
    logger.error("Failed to start SyncBoard API", { error });
    process.exit(1);
});
