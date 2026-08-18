import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";
import jwt from "jsonwebtoken";
import { env } from "@/config/env.js";
import { UserModel } from "@/models/user.model.js";
import { registerBoardHandlers } from "@/sockets/handlers/board.handler.js";
import { registerCardHandlers } from "@/sockets/handlers/card.handler.js";
import type { AppServer } from "@/sockets/types.js";

export const createSocketServer = (httpServer: HttpServer): AppServer => {
    const io: AppServer = new Server(httpServer, {
        cors: { origin: env.CORS_ORIGIN },
    });

    const pubClient = new Redis(env.REDIS_URL);
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token as string | undefined;
            if (!token) {
                throw new Error("Missing token");
            }

            const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
            const user = await UserModel.findById(payload.sub);
            if (!user) {
                throw new Error("User not found");
            }

            socket.data.user = user;
            next();
        } catch {
            next(new Error("Unauthorized"));
        }
    });

    io.on("connection", (socket) => {
        registerBoardHandlers(io, socket);
        registerCardHandlers(io, socket);
    });

    return io;
};
