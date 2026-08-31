import type { Socket } from "socket.io";
import { AppError, InternalServerError, toProblemPayload } from "@/utils/errors.js";
import { logger } from "@/utils/logger.js";

export const emitSocketError = (socket: Socket, error: unknown): void => {
    if (error instanceof AppError) {
        socket.emit("error", toProblemPayload(error));
        return;
    }

    logger.error("Unhandled socket error", { error });
    socket.emit(
        "error",
        toProblemPayload(new InternalServerError("An unexpected error occurred")),
    );
};
