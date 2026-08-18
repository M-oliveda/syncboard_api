import type { Socket } from "socket.io";
import { AppError } from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";

const ERROR_BASE_URI = "https://syncboard.moliveda.dev/errors";

interface SocketErrorPayload {
    type: string;
    title: string;
    status: number;
    detail: string;
}

export const emitSocketError = (socket: Socket, error: unknown): void => {
    if (error instanceof AppError) {
        const payload: SocketErrorPayload = {
            type: error.type,
            title: error.title,
            status: error.status,
            detail: error.detail,
        };
        socket.emit("error", payload);
        return;
    }

    logger.error("Unhandled socket error", { error });
    socket.emit("error", {
        type: `${ERROR_BASE_URI}/internal-error`,
        title: "Internal Server Error",
        status: 500,
        detail: "An unexpected error occurred",
    });
};
