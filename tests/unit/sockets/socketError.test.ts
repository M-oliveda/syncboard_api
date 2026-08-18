import { describe, test, expect, jest } from "@jest/globals";
import type { Socket } from "socket.io";

jest.unstable_mockModule("@/utils/logger.js", () => ({
    logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const { emitSocketError } = await import("@/sockets/socketError.js");
const { logger } = await import("@/utils/logger.js");
const { NotFoundError } = await import("@/utils/errors.js");

const buildSocket = () => ({ emit: jest.fn() }) as unknown as Socket;

describe("emitSocketError", () => {
    test("emits an RFC 7807-shaped payload for an AppError without logging", () => {
        const socket = buildSocket();

        emitSocketError(socket, new NotFoundError("Board 123 not found"));

        expect(socket.emit).toHaveBeenCalledWith("error", {
            type: expect.stringContaining("not-found"),
            title: "Not Found",
            status: 404,
            detail: "Board 123 not found",
        });
        expect(logger.error).not.toHaveBeenCalled();
    });

    test("emits a generic 500 payload and logs for an unknown error", () => {
        const socket = buildSocket();
        const error = new Error("boom");

        emitSocketError(socket, error);

        expect(socket.emit).toHaveBeenCalledWith("error", {
            type: expect.stringContaining("internal-error"),
            title: "Internal Server Error",
            status: 500,
            detail: "An unexpected error occurred",
        });
        expect(logger.error).toHaveBeenCalledWith(
            "Unhandled socket error",
            expect.objectContaining({ error }),
        );
    });
});
