import { describe, test, expect, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import { mockFn } from "../../../helpers/mockFn.js";

const assertBoardAccess = mockFn();

jest.unstable_mockModule("@/services/board.service.js", () => ({
    assertBoardAccess,
}));

const { registerBoardHandlers } = await import("@/sockets/handlers/board.handler.js");
const { ForbiddenError } = await import("@/utils/errors.js");

type Handler = (...args: unknown[]) => unknown;

const buildSocket = (userId = new Types.ObjectId(), email = "user@test.dev") => {
    const handlers = new Map<string, Handler>();
    const socket = {
        data: { user: { _id: userId, email } } as {
            user: { _id: Types.ObjectId; email: string };
            boardId?: string;
        },
        on: jest.fn((event: string, handler: Handler) => {
            handlers.set(event, handler);
        }),
        join: jest.fn(async () => {}),
        emit: jest.fn(),
    };
    return { socket, handlers };
};

const buildIo = (remoteUsers: { _id: Types.ObjectId; email: string }[]) => {
    const toEmit = jest.fn();
    const fetchSockets = jest.fn(async () =>
        remoteUsers.map((user) => ({ data: { user } })),
    );
    const io = {
        in: jest.fn(() => ({ fetchSockets })),
        to: jest.fn(() => ({ emit: toEmit })),
    };
    return { io, toEmit, fetchSockets };
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe("board:join", () => {
    test("joins the room and broadcasts presence when access is granted", async () => {
        const userId = new Types.ObjectId();
        const { socket, handlers } = buildSocket(userId, "user@test.dev");
        const { io, toEmit } = buildIo([{ _id: userId, email: "user@test.dev" }]);
        assertBoardAccess.mockResolvedValueOnce({});
        const boardId = new Types.ObjectId().toString();

        registerBoardHandlers(io as never, socket as never);
        await handlers.get("board:join")?.({ boardId });

        expect(assertBoardAccess).toHaveBeenCalledWith(boardId, userId.toString());
        expect(socket.join).toHaveBeenCalledWith(`board:${boardId}`);
        expect(socket.data).toMatchObject({ boardId });
        expect(io.to).toHaveBeenCalledWith(`board:${boardId}`);
        expect(toEmit).toHaveBeenCalledWith("board:user-presence", {
            boardId,
            activeUsers: [{ userId: userId.toString(), email: "user@test.dev" }],
        });
    });

    test("emits an error and never checks access for an invalid boardId", async () => {
        const { socket, handlers } = buildSocket();
        const { io } = buildIo([]);

        registerBoardHandlers(io as never, socket as never);
        await handlers.get("board:join")?.({ boardId: "not-an-id" });

        expect(assertBoardAccess).not.toHaveBeenCalled();
        expect(socket.join).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith(
            "error",
            expect.objectContaining({ status: 400 }),
        );
    });

    test("emits an error and never joins when access is denied", async () => {
        const { socket, handlers } = buildSocket();
        const { io } = buildIo([]);
        assertBoardAccess.mockRejectedValueOnce(new ForbiddenError("nope"));

        registerBoardHandlers(io as never, socket as never);
        await handlers.get("board:join")?.({
            boardId: new Types.ObjectId().toString(),
        });

        expect(socket.join).not.toHaveBeenCalled();
        expect(socket.emit).toHaveBeenCalledWith(
            "error",
            expect.objectContaining({ status: 403 }),
        );
    });
});

describe("disconnect", () => {
    test("re-broadcasts presence for the board the socket had joined", async () => {
        const userId = new Types.ObjectId();
        const { socket, handlers } = buildSocket(userId, "user@test.dev");
        const boardId = new Types.ObjectId().toString();
        socket.data.boardId = boardId;
        const { io, toEmit } = buildIo([]);

        registerBoardHandlers(io as never, socket as never);
        await handlers.get("disconnect")?.();

        expect(io.to).toHaveBeenCalledWith(`board:${boardId}`);
        expect(toEmit).toHaveBeenCalledWith(
            "board:user-presence",
            expect.objectContaining({ boardId }),
        );
    });

    test("does nothing when the socket never joined a board", async () => {
        const { socket, handlers } = buildSocket();
        const { io } = buildIo([]);

        registerBoardHandlers(io as never, socket as never);
        await handlers.get("disconnect")?.();

        expect(io.in).not.toHaveBeenCalled();
        expect(io.to).not.toHaveBeenCalled();
    });
});
